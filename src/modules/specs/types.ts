import type { Facet, FacetOption } from "./domain/facets"
import type { ResolvedSpec } from "./domain/resolve-specs"
import type {
  SpecDefinitionFields,
  SpecDefinitionInput,
  SpecKind,
} from "./domain/spec-definition"
import type { SpecFilter, SpecFilters } from "./domain/spec-filter"
import type { SpecValue, SpecValues } from "./domain/spec-value"

export type {
  Facet,
  FacetOption,
  ResolvedSpec,
  SpecDefinitionFields,
  SpecDefinitionInput,
  SpecFilter,
  SpecFilters,
  SpecKind,
  SpecValue,
  SpecValues,
}

export type SpecDefinitionDTO = SpecDefinitionFields & {
  id: string
  schema_id: string
}

/** A spec schema with its definitions in rank order. */
export type SpecSchemaDTO = {
  id: string
  definitions: SpecDefinitionDTO[]
}

/** One product's spec sheet with its present values, in rank order. */
export type ResolvedSheet = {
  id: string
  schema_id: string
  specs: ResolvedSpec[]
}

/** Adds a definition to a schema (no `id`) or changes one (`id`). */
export type UpsertSpecDefinitionInput =
  | (SpecDefinitionInput & { id?: undefined; schema_id: string })
  | (Partial<SpecDefinitionFields> & { id: string; schema_id?: string })
