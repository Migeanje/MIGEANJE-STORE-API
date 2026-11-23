import { duplicates, nonBlank, type Validation, validated } from "./validation"

export const VERDICT_MAX_LENGTH = 240
export const MIN_SCORE = 1
export const MAX_SCORE = 5

/** One rubric line of a review (F1 `RubricItem`), by criterion ID. */
export type ScoreInput = {
  criterion_id: string
  score: number
  note: string
}

/** The editable content of an expert review (F1 `ExpertReview`). */
export type ReviewInput = {
  verdict: string
  for_whom: string[]
  not_for: string[]
  scores: ScoreInput[]
}

const isScore = (score: unknown): score is number =>
  Number.isInteger(score) &&
  (score as number) >= MIN_SCORE &&
  (score as number) <= MAX_SCORE

const textList = (
  field: "for_whom" | "not_for",
  items: unknown,
  issues: string[],
): string[] => {
  const list = Array.isArray(items) ? items : []
  if (!list.length) {
    issues.push(`${field} needs at least one item`)
  }
  return list.map((item, index) => {
    const text = nonBlank(item)
    if (text === null) {
      issues.push(`${field}[${index}] must not be blank`)
    }
    return text ?? ""
  })
}

/**
 * Validates a review as F1 `expertReviewSchema` does: non-blank trimmed texts,
 * a verdict of at most 240 characters, at least one item in each list, scores
 * that are integers from 1 to 5, and no criterion scored twice. Whether each
 * criterion belongs to the review's rubric needs the rubric: the service
 * checks it.
 */
export const validateReviewInput = (
  input: ReviewInput,
): Validation<ReviewInput> => {
  const issues: string[] = []

  const verdict = nonBlank(input.verdict)
  if (verdict === null) {
    issues.push("verdict must not be blank")
  } else if (verdict.length > VERDICT_MAX_LENGTH) {
    issues.push(`verdict must be at most ${VERDICT_MAX_LENGTH} characters`)
  }

  const forWhom = textList("for_whom", input.for_whom, issues)
  const notFor = textList("not_for", input.not_for, issues)

  const scoreList = Array.isArray(input.scores) ? input.scores : []
  if (!scoreList.length) {
    issues.push("scores needs at least one item")
  }
  const scores = scoreList.map((line, index) => {
    const criterionId = nonBlank(line.criterion_id)
    if (criterionId === null) {
      issues.push(`scores[${index}].criterion_id must not be blank`)
    }
    if (!isScore(line.score)) {
      issues.push(
        `scores[${index}].score must be an integer from ${MIN_SCORE} to ${MAX_SCORE}`,
      )
    }
    const note = nonBlank(line.note)
    if (note === null) {
      issues.push(`scores[${index}].note must not be blank`)
    }
    return {
      criterion_id: criterionId ?? "",
      score: line.score,
      note: note ?? "",
    }
  })

  const scoredIds = scores
    .map((line) => line.criterion_id)
    .filter((criterionId) => criterionId !== "")
  for (const criterionId of duplicates(scoredIds)) {
    issues.push(`Rubric criterion "${criterionId}" is used twice`)
  }

  return validated(
    { verdict: verdict ?? "", for_whom: forWhom, not_for: notFor, scores },
    issues,
  )
}
