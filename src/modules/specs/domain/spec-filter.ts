import type { SpecKind } from "./spec-definition"

/**
 * F1 `SpecFilter`: an inclusive range for numbers, any of the selected
 * options for text and lists, "must be true" for booleans.
 */
export type SpecFilter =
  | { kind: "range"; min?: number; max?: number }
  | { kind: "options"; values: readonly string[] }
  | { kind: "toggle" }

/** Keyed by spec key. Filters combine with AND, options inside one with OR. */
export type SpecFilters = Readonly<Record<string, SpecFilter>>

const FILTER_KIND: Record<SpecKind, SpecFilter["kind"]> = {
  number: "range",
  text: "options",
  list: "options",
  boolean: "toggle",
}

type FilterableDefinition = { key: string; kind: SpecKind }

function shapeIssue(key: string, filter: SpecFilter): string | null {
  if (filter.kind === "range") {
    const bounds = [filter.min, filter.max].filter((b) => b !== undefined)
    return bounds.every((b) => typeof b === "number" && Number.isFinite(b))
      ? null
      : `Spec "${key}" has a range bound that is not a finite number`
  }
  if (filter.kind === "options") {
    return filter.values.every((v) => typeof v === "string")
      ? null
      : `Spec "${key}" has an option that is not text`
  }
  return null
}

/** Why the filters cannot apply to the schema's definitions. */
export function filterIssues(
  filters: SpecFilters,
  definitions: readonly FilterableDefinition[],
): string[] {
  const byKey = new Map(definitions.map((d) => [d.key, d]))
  return Object.entries(filters).flatMap(([key, filter]) => {
    const definition = byKey.get(key)
    if (definition === undefined) {
      return [`Spec "${key}" is not in the spec schema`]
    }
    const expected = FILTER_KIND[definition.kind]
    if (filter.kind !== expected) {
      return [
        `Spec "${key}" is a ${definition.kind} spec and takes a "${expected}" filter, got "${filter.kind}"`,
      ]
    }
    return shapeIssue(key, filter) ?? []
  })
}

function isEmptyFilter(filter: SpecFilter): boolean {
  if (filter.kind === "options") return filter.values.length === 0
  if (filter.kind === "range") {
    return filter.min === undefined && filter.max === undefined
  }
  return false
}

/**
 * The filters that narrow the result, each with its definition. Empty
 * selections are ignored, as F1 `filterProducts` does. Call after
 * `filterIssues` found nothing.
 */
export function activeFilters<D extends FilterableDefinition>(
  filters: SpecFilters,
  definitions: readonly D[],
): { definition: D; filter: SpecFilter }[] {
  return definitions.flatMap((definition) => {
    const filter = filters[definition.key]
    return filter === undefined || isEmptyFilter(filter)
      ? []
      : [{ definition, filter }]
  })
}
