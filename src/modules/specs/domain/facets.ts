import { readValue } from "./spec-value"
import { byRank, type StoredDefinition, type StoredValue } from "./stored"

/** One selectable value and how many products have it. */
export type FacetOption = { value: string; count: number }

/** A filter the category page can offer, built from a filterable spec. */
export type Facet =
  | {
      kind: "range"
      key: string
      label: string
      unit?: string
      min: number
      max: number
    }
  | { kind: "options"; key: string; label: string; options: FacetOption[] }
  | { kind: "toggle"; key: string; label: string; count: number }

const COLLATOR = new Intl.Collator("es-PE", {
  sensitivity: "base",
  numeric: true,
})

function countOptions(items: readonly string[]): FacetOption[] {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => COLLATOR.compare(a.value, b.value))
}

function specFacet(
  { key, label, unit, kind }: StoredDefinition,
  values: readonly StoredValue[],
): Facet | null {
  switch (kind) {
    case "number": {
      const numbers = values.flatMap((v) => readValue(kind, v) ?? [])
      if (numbers.length === 0) return null
      return {
        kind: "range",
        key,
        label,
        ...(unit !== null && { unit }),
        min: Math.min(...(numbers as number[])),
        max: Math.max(...(numbers as number[])),
      }
    }
    case "text":
    case "list": {
      // A list counts each product once per distinct item.
      const items = values.flatMap((v) => {
        const value = readValue(kind, v)
        if (value === null) return []
        return [...new Set(Array.isArray(value) ? value : [value as string])]
      })
      const options = countOptions(items)
      return options.length === 0
        ? null
        : { kind: "options", key, label, options }
    }
    case "boolean": {
      const count = values.filter((v) => readValue(kind, v) === true).length
      return count === 0 ? null : { kind: "toggle", key, label, count }
    }
  }
}

/**
 * F1 `computeFacets` for specs: one facet per filterable definition, in rank
 * order. `values` hold one value per product and definition. Facets no
 * product can match are left out.
 */
export function computeFacets(
  definitions: readonly StoredDefinition[],
  values: readonly StoredValue[],
): Facet[] {
  return byRank(definitions)
    .filter((definition) => definition.filterable)
    .flatMap((definition) => {
      const own = values.filter((v) => v.definition_id === definition.id)
      return specFacet(definition, own) ?? []
    })
}
