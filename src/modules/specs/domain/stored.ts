import type { SpecDefinitionFields } from "./spec-definition"
import type { SpecValueColumns } from "./spec-value"

/** A stored spec definition, as the read rules need it. */
export type StoredDefinition = SpecDefinitionFields & { id: string }

/** A stored spec value, as the read rules need it. */
export type StoredValue = SpecValueColumns & {
  sheet_id: string
  definition_id: string
}

/** A new array of the definitions in display order (lower rank first). */
export function byRank<T extends { rank: number }>(definitions: readonly T[]) {
  return [...definitions].sort((a, b) => a.rank - b.rank)
}
