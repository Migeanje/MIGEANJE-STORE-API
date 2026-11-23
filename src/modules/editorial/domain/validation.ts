/** The outcome of validating an input: the normalized value, or every issue. */
export type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; issues: string[] }

export const validated = <T>(value: T, issues: string[]): Validation<T> =>
  issues.length ? { ok: false, issues } : { ok: true, value }

/** Non-blank text, trimmed (F1 `textSchema`). Returns null when blank. */
export const nonBlank = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null
  }
  const text = value.trim()
  return text ? text : null
}

/** Returns the values that appear more than once, in first-seen order. */
export const duplicates = <T>(values: readonly T[]): T[] => {
  const seen = new Set<T>()
  const repeated = new Set<T>()
  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value)
    }
    seen.add(value)
  }
  return [...repeated]
}
