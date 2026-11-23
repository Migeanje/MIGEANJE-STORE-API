import type { SpecKind } from "./spec-definition"

/** F1 `SpecValue`: the kind of its definition decides which one. */
export type SpecValue = number | string | boolean | string[]

/** F1 `SpecValues`: one product's values, keyed by spec key. */
export type SpecValues = Record<string, SpecValue>

/** The typed columns of one stored value; exactly one is not null. */
export type SpecValueColumns = {
  number_value: number | null
  text_value: string | null
  boolean_value: boolean | null
  list_value: string[] | null
}

function hasDuplicates(values: readonly unknown[]): boolean {
  return new Set(values).size !== values.length
}

/** F1 `specValueIssue`: why `value` does not fit the kind, or null. */
export function specValueIssue(value: unknown, kind: SpecKind): string | null {
  const got = `got ${JSON.stringify(value)}`
  switch (kind) {
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? null
        : `Expected a finite number, ${got}`
    case "text":
      return typeof value === "string" && value.trim() !== ""
        ? null
        : `Expected non-blank text, ${got}`
    case "boolean":
      return typeof value === "boolean" ? null : `Expected a boolean, ${got}`
    case "list": {
      const valid =
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((item) => typeof item === "string" && item.trim() !== "") &&
        !hasDuplicates(value)
      return valid
        ? null
        : `Expected a list of distinct non-blank texts, ${got}`
    }
  }
}

/** Why one product's values do not fit the schema's definitions. */
export function sheetValueIssues(
  values: Readonly<Record<string, unknown>>,
  definitions: readonly { key: string; kind: SpecKind }[],
): string[] {
  const byKey = new Map(definitions.map((d) => [d.key, d]))
  return Object.entries(values).flatMap(([key, value]) => {
    const definition = byKey.get(key)
    if (definition === undefined) {
      return [`Spec "${key}" is not in the spec schema`]
    }
    const issue = specValueIssue(value, definition.kind)
    return issue === null ? [] : [`Spec "${key}": ${issue}`]
  })
}

/** The columns that store `value`, already checked against `kind`. */
export function toValueColumns(
  kind: SpecKind,
  value: SpecValue,
): SpecValueColumns {
  return {
    number_value: kind === "number" ? (value as number) : null,
    text_value: kind === "text" ? (value as string) : null,
    boolean_value: kind === "boolean" ? (value as boolean) : null,
    list_value: kind === "list" ? (value as string[]) : null,
  }
}

/** The stored value of a definition of `kind`, or null when it is missing. */
export function readValue(
  kind: SpecKind,
  columns: SpecValueColumns,
): SpecValue | null {
  switch (kind) {
    case "number":
      return columns.number_value
    case "text":
      return columns.text_value
    case "boolean":
      return columns.boolean_value
    case "list":
      return columns.list_value
  }
}
