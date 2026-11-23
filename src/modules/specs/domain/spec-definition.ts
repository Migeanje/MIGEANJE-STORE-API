/**
 * Rules for spec definitions: the specs a category's products can have.
 * Pure functions, free of Medusa; the service applies them.
 */

export const SPEC_KINDS = ["number", "text", "boolean", "list"] as const

export type SpecKind = (typeof SPEC_KINDS)[number]

/** F1 `keySchema`: camelCase, e.g. "maxPower". Mirrored by a database check. */
export const SPEC_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/

export type SpecDefinitionFields = {
  key: string
  /** Customer label, e.g. "Potencia máxima". */
  label: string
  /** Only for number specs, e.g. "W" or "pulgadas". */
  unit: string | null
  kind: SpecKind
  /** Offered as a category page facet. */
  filterable: boolean
  /** Shown as a comparator row. */
  comparable: boolean
  /** Display position, lower first (F1 `order`). */
  rank: number
}

export type SpecDefinitionInput = Pick<
  SpecDefinitionFields,
  "key" | "label" | "kind" | "rank"
> &
  Partial<Pick<SpecDefinitionFields, "unit" | "filterable" | "comparable">>

export function withDefinitionDefaults(
  input: SpecDefinitionInput,
): SpecDefinitionFields {
  return {
    key: input.key,
    label: input.label,
    unit: input.unit ?? null,
    kind: input.kind,
    filterable: input.filterable ?? false,
    comparable: input.comparable ?? true,
    rank: input.rank,
  }
}

/** Why the definition is invalid on its own; empty when it is valid. */
export function definitionIssues(definition: SpecDefinitionFields): string[] {
  const { key, label, unit, kind, rank } = definition
  const issues: string[] = []
  if (!SPEC_KEY_PATTERN.test(key)) {
    issues.push(`Spec key "${key}" must be camelCase, e.g. "maxPower"`)
  }
  if (label.trim() === "") {
    issues.push(`Spec "${key}" needs a label`)
  }
  if (!SPEC_KINDS.includes(kind)) {
    issues.push(`Spec "${key}" has an unknown kind "${kind}"`)
  } else if (unit !== null && kind !== "number") {
    issues.push(`Spec "${key}" has a unit but is not a number`)
  }
  if (!Number.isInteger(rank) || rank < 0) {
    issues.push(
      `Spec "${key}" needs a rank that is a whole number of 0 or more`,
    )
  }
  return issues
}

/** Returns the values that appear more than once, in first-seen order. */
function duplicates<T>(values: readonly T[]): T[] {
  const seen = new Set<T>()
  const repeated = new Set<T>()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated]
}

/** Keys, labels and ranks must be unique within one spec schema. */
export function duplicateDefinitionIssues(
  definitions: readonly Pick<SpecDefinitionFields, "key" | "label" | "rank">[],
): string[] {
  return [
    ...duplicates(definitions.map(({ key }) => key)).map(
      (key) => `Spec key "${key}" is defined twice`,
    ),
    ...duplicates(definitions.map(({ label }) => label)).map(
      (label) => `Spec label "${label}" is defined twice`,
    ),
    ...duplicates(definitions.map(({ rank }) => rank)).map(
      (rank) => `Spec rank ${rank} is used twice`,
    ),
  ]
}

function products(count: number): string {
  return count === 1 ? "1 product" : `${count} products`
}

type StoredFields = SpecDefinitionFields & { schema_id: string }

/**
 * Why `next` cannot replace `current`, or null. The key never changes
 * (immutable), a spec never moves to another schema, and the kind is frozen
 * once a product has a value for the spec.
 */
export function definitionChangeIssue(
  current: StoredFields,
  next: StoredFields,
  valueCount: number,
): string | null {
  if (next.key !== current.key) {
    return `Spec key "${current.key}" cannot change`
  }
  if (next.schema_id !== current.schema_id) {
    return `Spec "${current.key}" cannot move to another spec schema`
  }
  if (next.kind !== current.kind && valueCount > 0) {
    return `Spec "${current.key}" has values in ${products(valueCount)}, so its kind cannot change`
  }
  return null
}

/**
 * Why the spec cannot be deleted, or null. A spec schema keeps at least one
 * spec (F1 `specSchema.min(1)`), and a spec with values is not deleted with
 * them silently.
 */
export function definitionDeletionIssue({
  key,
  definitionCount,
  valueCount,
}: {
  key: string
  definitionCount: number
  valueCount: number
}): string | null {
  if (definitionCount <= 1) {
    return `Spec "${key}" is the last one of its spec schema, which needs at least one`
  }
  if (valueCount > 0) {
    return `Spec "${key}" has values in ${products(valueCount)}; remove them first`
  }
  return null
}
