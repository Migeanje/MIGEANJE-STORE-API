import type { Context, DAL } from "@medusajs/framework/types"
import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import {
  type CriterionInput,
  findCriterionConflicts,
  validateCriterionInput,
  validateRubricCriteria,
} from "./domain/criterion-input"
import { type ReviewInput, validateReviewInput } from "./domain/review-input"
import {
  ExpertReview,
  ReviewRubric,
  RubricCriterion,
  RubricScore,
} from "./models"

export type CriterionView = {
  id: string
  name: string
  rank: number
  rubric_id: string
}

export type RubricView = {
  id: string
  criteria: CriterionView[]
}

export type ReviewScoreView = {
  criterion_id: string
  criterion: string
  rank: number
  score: number
  note: string
}

export type ReviewView = {
  id: string
  rubric_id: string
  verdict: string
  for_whom: string[]
  not_for: string[]
  scores: ReviewScoreView[]
}

/** What the generated methods need to join a running transaction. */
type Transaction = { transactionManager: unknown }

const invalid = (issues: string[]) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, issues.join("; "))

const byRank = <T extends { rank: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.rank - b.rank)

const toCriterionView = (criterion: {
  id: string
  name: string
  rank: number
  rubric_id: string
}): CriterionView => ({
  id: criterion.id,
  name: criterion.name,
  rank: criterion.rank,
  rubric_id: criterion.rubric_id,
})

/**
 * The editorial module's port (docs/data-model/editorial.md, "Service
 * operations"): generated CRUD plus the operations that keep its rules.
 */
class EditorialModuleService extends MedusaService({
  ReviewRubric,
  Criterion: RubricCriterion,
  ExpertReview,
  RubricScore,
}) {
  // Set by MedusaService from the container; `declare` emits no field, so the
  // value it assigns is not overwritten.
  declare protected baseRepository_: DAL.RepositoryService

  /** Runs `task` in one database transaction: it commits whole or not at all. */
  private async inTransaction<T>(
    task: (transaction: Transaction) => Promise<T>,
  ): Promise<T> {
    return await this.baseRepository_.transaction(
      async (transactionManager: unknown) => await task({ transactionManager }),
    )
  }

  /** Creates a rubric with at least one criterion, all or nothing. */
  async createRubric(criteria: CriterionInput[]): Promise<RubricView> {
    const checked = validateRubricCriteria(criteria)
    if (!checked.ok) {
      throw invalid(checked.issues)
    }
    return await this.inTransaction((transaction) =>
      this.createRubric_(checked.value, transaction),
    )
  }

  private async createRubric_(
    criteria: CriterionInput[],
    transaction: Transaction,
  ): Promise<RubricView> {
    const rubric = await this.createReviewRubrics({}, transaction as Context)
    const created = await this.createCriteria(
      criteria.map((criterion) => ({ ...criterion, rubric_id: rubric.id })),
      transaction as Context,
    )
    return { id: rubric.id, criteria: byRank(created.map(toCriterionView)) }
  }

  /** Rubrics with their criteria in `rank` order. All rubrics by default. */
  async listRubrics(rubricIds?: string[]): Promise<RubricView[]> {
    const rubrics = await this.listReviewRubrics(
      rubricIds ? { id: rubricIds } : {},
      { relations: ["criteria"] },
    )
    return rubrics.map((rubric) => ({
      id: rubric.id,
      criteria: byRank(rubric.criteria.map(toCriterionView)),
    }))
  }

  /**
   * Creates (`criterionId` null) or updates a criterion, keeping `name` and
   * `rank` unique within its rubric.
   */
  async upsertCriterion(
    criterionId: string | null,
    rubricId: string,
    input: CriterionInput,
  ): Promise<CriterionView> {
    const checked = validateCriterionInput(input)
    if (!checked.ok) {
      throw invalid(checked.issues)
    }
    await this.retrieveReviewRubric(rubricId, {})
    if (criterionId !== null) {
      await this.retrieveCriterion(criterionId, {})
    }

    const siblings = await this.listCriteria({ rubric_id: rubricId }, {})
    const conflicts = findCriterionConflicts(
      checked.value,
      siblings.filter(({ id }) => id !== criterionId),
    )
    if (conflicts.length) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        conflicts.join("; "),
      )
    }

    const saved =
      criterionId === null
        ? await this.createCriteria({ ...checked.value, rubric_id: rubricId })
        : await this.updateCriteria({
            id: criterionId,
            ...checked.value,
            rubric_id: rubricId,
          })
    return toCriterionView(saved)
  }

  /** Deletes a criterion; refused while a review score uses it. */
  async deleteCriterion(criterionId: string): Promise<void> {
    await this.retrieveCriterion(criterionId, {})
    const scores = await this.listRubricScores(
      { criterion_id: criterionId },
      { take: 1 },
    )
    if (scores.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Criterion ${criterionId} is used by a review score`,
      )
    }
    await this.deleteCriteria(criterionId)
  }

  /** A review with its scores in criterion `rank` order. */
  async getReview(reviewId: string): Promise<ReviewView> {
    const review = await this.retrieveExpertReview(reviewId, {
      relations: ["scores", "scores.criterion"],
    })
    const scores = review.scores.map((line) => ({
      criterion_id: line.criterion.id,
      criterion: line.criterion.name,
      rank: line.criterion.rank,
      score: line.score,
      note: line.note,
    }))
    return {
      id: review.id,
      rubric_id: review.rubric_id,
      verdict: review.verdict,
      for_whom: review.for_whom as string[],
      not_for: review.not_for as string[],
      scores: byRank(scores),
    }
  }

  /**
   * Creates (`reviewId` null) or replaces a review: validates it as F1
   * `expertReviewSchema` does, and requires every scored criterion to belong
   * to the review's rubric. All or nothing.
   */
  async upsertReview(
    reviewId: string | null,
    rubricId: string,
    input: ReviewInput,
  ): Promise<{ id: string }> {
    const checked = validateReviewInput(input)
    if (!checked.ok) {
      throw invalid(checked.issues)
    }
    await this.retrieveReviewRubric(rubricId, {})
    if (reviewId !== null) {
      await this.retrieveExpertReview(reviewId, {})
    }

    const criteria = await this.listCriteria({ rubric_id: rubricId }, {})
    const ownIds = new Set(criteria.map(({ id }) => id))
    const foreign = checked.value.scores
      .map(({ criterion_id }) => criterion_id)
      .filter((criterionId) => !ownIds.has(criterionId))
    if (foreign.length) {
      throw invalid(
        foreign.map(
          (criterionId) =>
            `Criterion ${criterionId} does not belong to the review's rubric`,
        ),
      )
    }

    return await this.inTransaction((transaction) =>
      this.upsertReview_(reviewId, rubricId, checked.value, transaction),
    )
  }

  private async upsertReview_(
    reviewId: string | null,
    rubricId: string,
    input: ReviewInput,
    transaction: Transaction,
  ): Promise<{ id: string }> {
    const { scores, ...content } = input
    let id: string
    if (reviewId === null) {
      const created = await this.createExpertReviews(
        { ...content, rubric_id: rubricId },
        transaction as Context,
      )
      id = created.id
    } else {
      await this.updateExpertReviews(
        { id: reviewId, ...content, rubric_id: rubricId },
        transaction as Context,
      )
      const previous = await this.listRubricScores(
        { review_id: reviewId },
        {},
        transaction as Context,
      )
      if (previous.length) {
        await this.deleteRubricScores(
          previous.map(({ id: scoreId }) => scoreId),
          transaction as Context,
        )
      }
      id = reviewId
    }
    await this.createRubricScores(
      scores.map((line) => ({ ...line, review_id: id })),
      transaction as Context,
    )
    return { id }
  }
}

export default EditorialModuleService
