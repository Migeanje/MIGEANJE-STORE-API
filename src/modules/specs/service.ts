import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import { computeFacets, type Facet } from "./domain/facets"
import { resolveSpecs } from "./domain/resolve-specs"
import {
  definitionChangeIssue,
  definitionDeletionIssue,
  definitionIssues,
  duplicateDefinitionIssues,
  type SpecDefinitionFields,
  type SpecDefinitionInput,
  withDefinitionDefaults,
} from "./domain/spec-definition"
import {
  activeFilters,
  filterIssues,
  type SpecFilters,
} from "./domain/spec-filter"
import {
  type SpecValues,
  sheetValueIssues,
  toValueColumns,
} from "./domain/spec-value"
import { byRank, type StoredDefinition } from "./domain/stored"
import ProductSpecSheet from "./models/product-spec-sheet"
import SpecDefinition from "./models/spec-definition"
import SpecSchema from "./models/spec-schema"
import SpecValue from "./models/spec-value"
import type {
  ResolvedSheet,
  SpecDefinitionDTO,
  SpecSchemaDTO,
  UpsertSpecDefinitionInput,
} from "./types"

type DefinitionRow = SpecDefinitionFields & { id: string; schema_id: string }

function toDefinitionDTO(row: DefinitionRow): SpecDefinitionDTO {
  return {
    id: row.id,
    schema_id: row.schema_id,
    key: row.key,
    label: row.label,
    unit: row.unit,
    kind: row.kind,
    filterable: row.filterable,
    comparable: row.comparable,
    rank: row.rank,
  }
}

function fail(
  type: (typeof MedusaError.Types)[keyof typeof MedusaError.Types],
  issues: string[],
): never {
  throw new MedusaError(type, issues.join("; "))
}

/**
 * Technical specifications of products: each category's spec schema, and the
 * spec values of each product (docs/data-model/specs.md).
 */
class SpecsModuleService extends MedusaService({
  SpecSchema,
  SpecDefinition,
  ProductSpecSheet,
  SpecValue,
}) {
  private async definitionsOf(schemaId: string): Promise<SpecDefinitionDTO[]> {
    const rows = (await this.listSpecDefinitions({
      schema_id: schemaId,
    })) as unknown as DefinitionRow[]
    return byRank(rows.map(toDefinitionDTO))
  }

  /** Creates a spec schema with its first definitions. */
  async createSchema(
    definitions: SpecDefinitionInput[],
  ): Promise<SpecSchemaDTO> {
    if (definitions.length === 0) {
      fail(MedusaError.Types.INVALID_DATA, [
        "A spec schema needs at least one spec",
      ])
    }
    const fields = definitions.map(withDefinitionDefaults)
    const invalid = fields.flatMap(definitionIssues)
    if (invalid.length > 0) fail(MedusaError.Types.INVALID_DATA, invalid)
    const repeated = duplicateDefinitionIssues(fields)
    if (repeated.length > 0) fail(MedusaError.Types.DUPLICATE_ERROR, repeated)

    const schema = await this.createSpecSchemas({})
    try {
      await this.createSpecDefinitions(
        fields.map((field) => ({ ...field, schema_id: schema.id })),
      )
    } catch (error) {
      await this.deleteSpecSchemas([schema.id])
      throw error
    }
    return { id: schema.id, definitions: await this.definitionsOf(schema.id) }
  }

  /** The schema with its definitions in rank order. */
  async getSchema(schemaId: string): Promise<SpecSchemaDTO> {
    await this.retrieveSpecSchema(schemaId)
    return { id: schemaId, definitions: await this.definitionsOf(schemaId) }
  }

  /** Adds a definition (no `id`) or changes one (`id`). */
  async upsertDefinition(
    input: UpsertSpecDefinitionInput,
  ): Promise<SpecDefinitionDTO> {
    if (input.id === undefined) {
      return await this.addDefinition(input)
    }
    return await this.changeDefinition(input)
  }

  private async addDefinition(
    input: Extract<UpsertSpecDefinitionInput, { id?: undefined }>,
  ): Promise<SpecDefinitionDTO> {
    const { schema_id, ...rest } = input
    const schema = await this.getSchema(schema_id)
    const fields = withDefinitionDefaults(rest)
    const invalid = definitionIssues(fields)
    if (invalid.length > 0) fail(MedusaError.Types.INVALID_DATA, invalid)
    const repeated = duplicateDefinitionIssues([...schema.definitions, fields])
    if (repeated.length > 0) fail(MedusaError.Types.DUPLICATE_ERROR, repeated)

    const created = (await this.createSpecDefinitions({
      ...fields,
      schema_id,
    })) as unknown as DefinitionRow
    return toDefinitionDTO(created)
  }

  private async changeDefinition(
    input: Extract<UpsertSpecDefinitionInput, { id: string }>,
  ): Promise<SpecDefinitionDTO> {
    const { id, ...changes } = input
    const current = toDefinitionDTO(
      (await this.retrieveSpecDefinition(id)) as unknown as DefinitionRow,
    )
    const defined = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    )
    const next: DefinitionRow = { ...current, ...defined }

    const valueCount =
      next.kind === current.kind
        ? 0
        : (await this.listSpecValues({ definition_id: id })).length
    const blocked = definitionChangeIssue(current, next, valueCount)
    if (blocked !== null) fail(MedusaError.Types.NOT_ALLOWED, [blocked])
    const invalid = definitionIssues(next)
    if (invalid.length > 0) fail(MedusaError.Types.INVALID_DATA, invalid)
    const siblings = (await this.definitionsOf(current.schema_id)).filter(
      (definition) => definition.id !== id,
    )
    const repeated = duplicateDefinitionIssues([...siblings, next])
    if (repeated.length > 0) fail(MedusaError.Types.DUPLICATE_ERROR, repeated)

    const updated = (await this.updateSpecDefinitions({
      id,
      ...defined,
    })) as unknown as DefinitionRow
    return toDefinitionDTO(updated)
  }

  /** Deletes a definition that has no values and is not the schema's last. */
  async deleteDefinition(definitionId: string): Promise<void> {
    const definition = toDefinitionDTO(
      (await this.retrieveSpecDefinition(
        definitionId,
      )) as unknown as DefinitionRow,
    )
    const issue = definitionDeletionIssue({
      key: definition.key,
      definitionCount: (await this.definitionsOf(definition.schema_id)).length,
      valueCount: (await this.listSpecValues({ definition_id: definitionId }))
        .length,
    })
    if (issue !== null) fail(MedusaError.Types.NOT_ALLOWED, [issue])
    await this.softDeleteSpecDefinitions([definitionId])
  }

  /**
   * Creates the sheet (`sheetId` null) or replaces the values of an existing
   * one, after checking every value against its definition.
   */
  async upsertSheet(
    sheetId: string | null,
    schemaId: string,
    values: SpecValues,
  ): Promise<ResolvedSheet> {
    const { definitions } = await this.getSchema(schemaId)
    if (sheetId !== null) await this.retrieveProductSpecSheet(sheetId)
    const invalid = sheetValueIssues(values, definitions)
    if (invalid.length > 0) fail(MedusaError.Types.INVALID_DATA, invalid)

    const id =
      sheetId ??
      (await this.createProductSpecSheets({ schema_id: schemaId })).id
    if (sheetId !== null) {
      await this.updateProductSpecSheets({ id, schema_id: schemaId })
      const old = await this.listSpecValues({ sheet_id: id })
      if (old.length > 0) {
        await this.deleteSpecValues(old.map((value) => value.id))
      }
    }
    const byKey = new Map(definitions.map((d) => [d.key, d]))
    const rows = Object.entries(values).map(([key, value]) => {
      const definition = byKey.get(key) as SpecDefinitionDTO
      return {
        sheet_id: id,
        definition_id: definition.id,
        ...toValueColumns(definition.kind, value),
      }
    })
    if (rows.length > 0) await this.createSpecValues(rows)
    const [sheet] = await this.listResolvedSpecs([id])
    return sheet
  }

  /** Per sheet, the present values with their definitions, in rank order. */
  async listResolvedSpecs(sheetIds: string[]): Promise<ResolvedSheet[]> {
    if (sheetIds.length === 0) return []
    const sheets = await this.listProductSpecSheets({ id: sheetIds })
    const byId = new Map(sheets.map((sheet) => [sheet.id, sheet]))
    const values = await this.listSpecValues({ sheet_id: [...byId.keys()] })
    const definitions = new Map<string, SpecDefinitionDTO[]>()
    for (const schemaId of new Set(sheets.map((sheet) => sheet.schema_id))) {
      definitions.set(schemaId, await this.definitionsOf(schemaId))
    }
    return sheetIds.flatMap((id) => {
      const sheet = byId.get(id)
      if (sheet === undefined) return []
      return [
        {
          id,
          schema_id: sheet.schema_id,
          specs: resolveSpecs(
            (definitions.get(sheet.schema_id) ?? []).map(
              ({ schema_id: _schema, ...definition }) => definition,
            ),
            values.filter((value) => value.sheet_id === id),
          ),
        },
      ]
    })
  }

  /** One facet per filterable spec, counting only the given sheets. */
  async computeFacets(schemaId: string, sheetIds: string[]): Promise<Facet[]> {
    const { definitions } = await this.getSchema(schemaId)
    if (sheetIds.length === 0) return []
    const sheets = await this.listProductSpecSheets({
      id: sheetIds,
      schema_id: schemaId,
    })
    if (sheets.length === 0) return []
    const values = await this.listSpecValues({
      sheet_id: sheets.map((sheet) => sheet.id),
    })
    return computeFacets(definitions as StoredDefinition[], values)
  }

  /**
   * The sheet IDs that match every filter. With `sheetIds`, only those sheets
   * are searched and the result keeps their order.
   */
  async matchSheets(
    schemaId: string,
    filters: SpecFilters,
    sheetIds?: string[],
  ): Promise<string[]> {
    const { definitions } = await this.getSchema(schemaId)
    const invalid = filterIssues(filters, definitions)
    if (invalid.length > 0) fail(MedusaError.Types.INVALID_DATA, invalid)
    if (sheetIds?.length === 0) return []

    const sheets = await this.listProductSpecSheets({
      schema_id: schemaId,
      ...(sheetIds && { id: sheetIds }),
    })
    let matched = sheets.map((sheet) => sheet.id)
    for (const { definition, filter } of activeFilters(filters, definitions)) {
      if (matched.length === 0) break
      const base = { definition_id: definition.id, sheet_id: matched }
      // number_value is a float4 (`real`) column, which PostgreSQL compares
      // as a double: round the bounds to float4 so a bound equal to a stored
      // value (1.24) includes it.
      const where =
        filter.kind === "range"
          ? {
              number_value: {
                ...(filter.min !== undefined && {
                  $gte: Math.fround(filter.min),
                }),
                ...(filter.max !== undefined && {
                  $lte: Math.fround(filter.max),
                }),
              },
            }
          : filter.kind === "toggle"
            ? { boolean_value: true }
            : definition.kind === "list"
              ? { list_value: { $overlap: [...filter.values] } }
              : { text_value: { $in: [...filter.values] } }
      const rows = await this.listSpecValues({ ...base, ...where } as never)
      const hits = new Set(rows.map((row) => row.sheet_id))
      matched = matched.filter((id) => hits.has(id))
    }
    if (sheetIds === undefined) return matched
    const wanted = new Set(matched)
    return sheetIds.filter((id) => wanted.has(id))
  }
}

export default SpecsModuleService
