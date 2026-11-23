import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { ensureTestDatabase } from "../../../../integration-tests/support/ensure-test-database"
import { EDITORIAL_MODULE } from ".."
import {
  ExpertReview,
  ReviewRubric,
  RubricCriterion,
  RubricScore,
} from "../models"
import type EditorialModuleService from "../service"

jest.setTimeout(60 * 1000)

// Database rules of docs/data-model/editorial.md, through the generated CRUD.
ensureTestDatabase(EDITORIAL_MODULE)

moduleIntegrationTestRunner<EditorialModuleService>({
  moduleName: EDITORIAL_MODULE,
  resolve: "./src/modules/editorial",
  moduleModels: [ReviewRubric, RubricCriterion, ExpertReview, RubricScore],
  testSuite: ({ service }) => {
    const createRubricWithCriteria = async (names: string[]) => {
      const rubric = await service.createReviewRubrics({})
      const criteria = await service.createCriteria(
        names.map((name, rank) => ({ name, rank, rubric_id: rubric.id })),
      )
      return { rubric, criteria }
    }

    const reviewData = (rubricId: string) => ({
      rubric_id: rubricId,
      verdict: "Buen cargador.",
      for_whom: ["Quien viaja", "Quien carga laptop"],
      not_for: ["Quien solo carga un celular", "Quien busca lo más barato"],
    })

    describe("editorial data models", () => {
      it("prefixes every ID as the data model page says", async () => {
        const { rubric, criteria } = await createRubricWithCriteria([
          "Potencia",
        ])
        const review = await service.createExpertReviews(reviewData(rubric.id))
        const score = await service.createRubricScores({
          review_id: review.id,
          criterion_id: criteria[0].id,
          score: 4,
          note: "100 W reales.",
        })

        expect(rubric.id).toMatch(/^rvrub_/)
        expect(criteria[0].id).toMatch(/^rvcrit_/)
        expect(review.id).toMatch(/^exrev_/)
        expect(score.id).toMatch(/^rvscore_/)
      })

      it("keeps the order of for_whom and not_for", async () => {
        const { rubric } = await createRubricWithCriteria(["Potencia"])
        const created = await service.createExpertReviews(reviewData(rubric.id))

        const review = await service.retrieveExpertReview(created.id)

        expect(review.for_whom).toEqual(["Quien viaja", "Quien carga laptop"])
        expect(review.not_for).toEqual([
          "Quien solo carga un celular",
          "Quien busca lo más barato",
        ])
      })

      it("keeps criterion names unique per rubric", async () => {
        const { rubric } = await createRubricWithCriteria(["Potencia"])

        await expect(
          service.createCriteria({
            name: "Potencia",
            rank: 1,
            rubric_id: rubric.id,
          }),
        ).rejects.toThrow()
        expect(
          await service.listCriteria({ rubric_id: rubric.id }),
        ).toHaveLength(1)
      })

      it("keeps criterion ranks unique per rubric", async () => {
        const { rubric } = await createRubricWithCriteria(["Potencia"])

        await expect(
          service.createCriteria({
            name: "Portabilidad",
            rank: 0,
            rubric_id: rubric.id,
          }),
        ).rejects.toThrow()
        expect(
          await service.listCriteria({ rubric_id: rubric.id }),
        ).toHaveLength(1)
      })

      it("allows the same criterion name and rank in another rubric", async () => {
        await createRubricWithCriteria(["Potencia"])
        const { criteria } = await createRubricWithCriteria(["Potencia"])

        expect(criteria[0]).toEqual(
          expect.objectContaining({ name: "Potencia", rank: 0 }),
        )
      })

      it("frees a deleted criterion's name and rank (partial indexes)", async () => {
        const { rubric, criteria } = await createRubricWithCriteria([
          "Potencia",
        ])
        await service.softDeleteCriteria([criteria[0].id])

        const replacement = await service.createCriteria({
          name: "Potencia",
          rank: 0,
          rubric_id: rubric.id,
        })

        expect(replacement.id).not.toBe(criteria[0].id)
        expect(await service.listCriteria({ rubric_id: rubric.id })).toEqual([
          expect.objectContaining({ id: replacement.id, name: "Potencia" }),
        ])
      })

      it("keeps a criterion unique per review", async () => {
        const { rubric, criteria } = await createRubricWithCriteria([
          "Potencia",
        ])
        const review = await service.createExpertReviews(reviewData(rubric.id))
        const score = {
          review_id: review.id,
          criterion_id: criteria[0].id,
          score: 4,
          note: "Bien.",
        }
        await service.createRubricScores(score)

        await expect(service.createRubricScores(score)).rejects.toThrow()
        expect(
          await service.listRubricScores({ review_id: review.id }),
        ).toHaveLength(1)
      })

      it("accepts a verdict of 240 characters and rejects 241", async () => {
        const { rubric } = await createRubricWithCriteria(["Potencia"])

        const longest = await service.createExpertReviews({
          ...reviewData(rubric.id),
          verdict: "a".repeat(240),
        })
        await expect(
          service.createExpertReviews({
            ...reviewData(rubric.id),
            verdict: "a".repeat(241),
          }),
        ).rejects.toThrow()

        expect(longest.verdict).toHaveLength(240)
        expect(await service.listExpertReviews()).toHaveLength(1)
      })

      it("rejects a blank verdict", async () => {
        const { rubric } = await createRubricWithCriteria(["Potencia"])

        await expect(
          service.createExpertReviews({
            ...reviewData(rubric.id),
            verdict: " ",
          }),
        ).rejects.toThrow()
        expect(await service.listExpertReviews()).toHaveLength(0)
      })

      it("accepts scores from 1 to 5", async () => {
        const { rubric, criteria } = await createRubricWithCriteria([
          "Potencia",
          "Portabilidad",
        ])
        const review = await service.createExpertReviews(reviewData(rubric.id))

        const scores = await service.createRubricScores([
          {
            review_id: review.id,
            criterion_id: criteria[0].id,
            score: 1,
            note: "Poca.",
          },
          {
            review_id: review.id,
            criterion_id: criteria[1].id,
            score: 5,
            note: "Mucha.",
          },
        ])

        expect(scores.map(({ score }) => score)).toEqual([1, 5])
      })

      it.each([0, 6])("rejects a score of %p", async (score) => {
        const { rubric, criteria } = await createRubricWithCriteria([
          "Potencia",
        ])
        const review = await service.createExpertReviews(reviewData(rubric.id))

        await expect(
          service.createRubricScores({
            review_id: review.id,
            criterion_id: criteria[0].id,
            score,
            note: "Nota.",
          }),
        ).rejects.toThrow()
        expect(
          await service.listRubricScores({ review_id: review.id }),
        ).toHaveLength(0)
      })

      it("deletes a review's scores with the review", async () => {
        const { rubric, criteria } = await createRubricWithCriteria([
          "Potencia",
          "Portabilidad",
        ])
        const review = await service.createExpertReviews(reviewData(rubric.id))
        await service.createRubricScores(
          criteria.map((criterion) => ({
            review_id: review.id,
            criterion_id: criterion.id,
            score: 3,
            note: "Bien.",
          })),
        )

        await service.softDeleteExpertReviews([review.id])

        expect(
          await service.listRubricScores({ review_id: review.id }),
        ).toEqual([])
        const deleted = await service.listRubricScores(
          { review_id: review.id },
          { withDeleted: true },
        )
        expect(deleted).toHaveLength(2)
        for (const score of deleted) {
          expect(score.deleted_at).not.toBeNull()
        }
      })
    })
  },
})
