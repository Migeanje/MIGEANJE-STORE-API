import { duplicates, nonBlank, type Validation, validated } from "./validation"

/** A rubric criterion: its customer label and its display order. */
export type CriterionInput = {
  name: string
  rank: number
}

const isRank = (rank: unknown): rank is number =>
  Number.isInteger(rank) && (rank as number) >= 0

const checkCriterion = (
  input: CriterionInput,
  prefix: string,
  issues: string[],
): CriterionInput => {
  const name = nonBlank(input.name)
  if (name === null) {
    issues.push(`${prefix}name must not be blank`)
  }
  if (!isRank(input.rank)) {
    issues.push(`${prefix}rank must be an integer of 0 or more`)
  }
  return { name: name ?? "", rank: input.rank }
}

/** A non-blank trimmed name and an integer rank of 0 or more. */
export const validateCriterionInput = (
  input: CriterionInput,
): Validation<CriterionInput> => {
  const issues: string[] = []
  const value = checkCriterion(input, "", issues)
  return validated(value, issues)
}

/**
 * The criteria of a new rubric: at least one, each valid, and no name or
 * rank used twice.
 */
export const validateRubricCriteria = (
  criteria: CriterionInput[],
): Validation<CriterionInput[]> => {
  const issues: string[] = []
  if (!criteria.length) {
    issues.push("A rubric needs at least one criterion")
  }
  const value = criteria.map((criterion, index) =>
    checkCriterion(criterion, `criteria[${index}].`, issues),
  )
  const names = value.map(({ name }) => name).filter((name) => name !== "")
  for (const name of duplicates(names)) {
    issues.push(`Criterion name "${name}" is used twice`)
  }
  for (const rank of duplicates(value.map(({ rank }) => rank))) {
    issues.push(`Criterion rank ${rank} is used twice`)
  }
  return validated(value, issues)
}

/** The name and rank of `candidate` that other criteria of its rubric hold. */
export const findCriterionConflicts = (
  candidate: CriterionInput,
  others: readonly CriterionInput[],
): string[] => {
  const conflicts: string[] = []
  if (others.some(({ name }) => name === candidate.name)) {
    conflicts.push(
      `The rubric already has a criterion named "${candidate.name}"`,
    )
  }
  if (others.some(({ rank }) => rank === candidate.rank)) {
    conflicts.push(
      `The rubric already has a criterion at rank ${candidate.rank}`,
    )
  }
  return conflicts
}
