import type { SpecDefinitionFields } from "./spec-definition"
import { readValue, type SpecValue } from "./spec-value"
import { byRank, type StoredDefinition, type StoredValue } from "./stored"

/** One present spec of a product, with its definition. */
export type ResolvedSpec = SpecDefinitionFields & {
  definition_id: string
  value: SpecValue
}

/**
 * F1 `resolveSpecs`: one product's present values with their definitions, in
 * rank order. `values` belong to one sheet; values of definitions outside
 * `definitions` are left out.
 */
export function resolveSpecs(
  definitions: readonly StoredDefinition[],
  values: readonly StoredValue[],
): ResolvedSpec[] {
  const byDefinition = new Map(values.map((v) => [v.definition_id, v]))
  return byRank(definitions).flatMap(({ id, ...fields }) => {
    const stored = byDefinition.get(id)
    const value = stored ? readValue(fields.kind, stored) : null
    return value === null ? [] : [{ definition_id: id, ...fields, value }]
  })
}
