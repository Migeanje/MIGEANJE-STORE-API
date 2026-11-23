import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { ensureTestDatabase } from "../../../../integration-tests/support/ensure-test-database"
import { EDITORIAL_MODULE } from ".."
import {
  ExpertReview,
  ReviewRubric,
  RubricCriterion,
  RubricScore,
} from "../models"
import EditorialModuleService from "../service"

jest.setTimeout(60 * 1000)

const review = (criterionIds: string[], overrides = {}) => ({
  verdict: "Buen cargador.",
  for_whom: ["Quien viaja"],
  not_for: ["Quien busca lo más barato"],
  scores: criterionIds.map((criterion_id, index) => ({
    criterion_id,
    score: index + 1,
    note: `Nota ${index + 1}.`,
  })),
  ...overrides,
})

// Service operations of docs/data-model/editorial.md.
ensureTestDatabase(EDITORIAL_MODULE)

moduleIntegrationTestRunner<EditorialModuleService>({
  moduleName: EDITORIAL_MODULE,
  resolve: "./src/modules/editorial",
  moduleModels: [ReviewRubric, RubricCriterion, ExpertReview, RubricScore],
  testSuite: ({ service }) => {
    const rubricOf = (...names: string[]) =>
      service.createRubric(names.map((name, rank) => ({ name, rank })))

    describe("createRubric", () => {
      it("creates a rubric with its criteria", async () => {
        const rubric = await rubricOf("Potencia", "Portabilidad")

        expect(rubric.id).toMatch(/^rvrub_/)
        expect(rubric.criteria.map(({ name, rank }) => [name, rank])).toEqual([
          ["Potencia", 0],
          ["Portabilidad", 1],
        ])
      })

      it("refuses a rubric without criteria and creates nothing", async () => {
        await expect(service.createRubric([])).rejects.toThrow(
          "A rubric needs at least one criterion",
        )
        expect(await service.listReviewRubrics()).toHaveLength(0)
      })

      it("refuses repeated names or ranks and creates nothing", async () => {
        await expect(
          service.createRubric([
            { name: "Potencia", rank: 0 },
            { name: "Potencia", rank: 0 },
          ]),
        ).rejects.toThrow(/used twice/)
        expect(await service.listReviewRubrics()).toHaveLength(0)
        expect(await service.listCriteria()).toHaveLength(0)
      })
    })

    describe("listRubrics", () => {
      it("lists criteria in rank order", async () => {
        const rubric = await service.createRubric([
          { name: "Tercero", rank: 2 },
          { name: "Primero", rank: 0 },
          { name: "Segundo", rank: 1 },
        ])

        const [listed] = await service.listRubrics()

        expect(listed.id).toBe(rubric.id)
        expect(listed.criteria.map(({ name }) => name)).toEqual([
          "Primero",
          "Segundo",
          "Tercero",
        ])
      })

      it("filters by rubric IDs", async () => {
        const first = await rubricOf("Potencia")
        await rubricOf("Sonido")

        const listed = await service.listRubrics([first.id])

        expect(listed.map(({ id }) => id)).toEqual([first.id])
      })
    })

    describe("upsertCriterion", () => {
      it("creates a criterion in a rubric", async () => {
        const rubric = await rubricOf("Potencia")

        const criterion = await service.upsertCriterion(null, rubric.id, {
          name: " Portabilidad ",
          rank: 1,
        })

        expect(criterion).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^rvcrit_/),
            name: "Portabilidad",
            rank: 1,
            rubric_id: rubric.id,
          }),
        )
      })

      it("updates a criterion and lets it keep its own name and rank", async () => {
        const rubric = await rubricOf("Potencia", "Portabilidad")
        const [first] = rubric.criteria

        const updated = await service.upsertCriterion(first.id, rubric.id, {
          name: "Potencia",
          rank: 5,
        })

        expect(updated).toEqual(
          expect.objectContaining({ id: first.id, name: "Potencia", rank: 5 }),
        )
        expect(
          await service.listCriteria({ rubric_id: rubric.id }),
        ).toHaveLength(2)
      })

      it("refuses a name or rank another criterion of the rubric holds", async () => {
        const rubric = await rubricOf("Potencia", "Portabilidad")
        const [first] = rubric.criteria

        await expect(
          service.upsertCriterion(null, rubric.id, {
            name: "Potencia",
            rank: 9,
          }),
        ).rejects.toThrow('already has a criterion named "Potencia"')
        await expect(
          service.upsertCriterion(first.id, rubric.id, {
            name: "Otro",
            rank: 1,
          }),
        ).rejects.toThrow("already has a criterion at rank 1")
        expect(
          await service.listCriteria({ rubric_id: rubric.id }),
        ).toHaveLength(2)
      })

      it("allows the same name and rank in another rubric", async () => {
        await rubricOf("Potencia")
        const other = await rubricOf("Sonido")

        const criterion = await service.upsertCriterion(null, other.id, {
          name: "Potencia",
          rank: 1,
        })

        expect(criterion.name).toBe("Potencia")
      })

      it("refuses a blank name or a negative rank", async () => {
        const rubric = await rubricOf("Potencia")

        await expect(
          service.upsertCriterion(null, rubric.id, { name: " ", rank: 3 }),
        ).rejects.toThrow("name must not be blank")
        await expect(
          service.upsertCriterion(null, rubric.id, { name: "X", rank: -1 }),
        ).rejects.toThrow("rank must be an integer of 0 or more")
      })

      it("refuses an unknown rubric or criterion", async () => {
        const rubric = await rubricOf("Potencia")

        await expect(
          service.upsertCriterion(null, "rvrub_missing", {
            name: "X",
            rank: 3,
          }),
        ).rejects.toThrow(/rvrub_missing/)
        await expect(
          service.upsertCriterion("rvcrit_missing", rubric.id, {
            name: "X",
            rank: 3,
          }),
        ).rejects.toThrow(/rvcrit_missing/)
      })
    })

    describe("deleteCriterion", () => {
      it("deletes a criterion no score uses", async () => {
        const rubric = await rubricOf("Potencia", "Portabilidad")
        const [first] = rubric.criteria

        await service.deleteCriterion(first.id)

        const remaining = await service.listCriteria({ rubric_id: rubric.id })
        expect(remaining.map(({ id }) => id)).not.toContain(first.id)
        expect(remaining).toHaveLength(1)
      })

      it("refuses while a score uses it", async () => {
        const rubric = await rubricOf("Potencia", "Portabilidad")
        const [first, second] = rubric.criteria
        await service.upsertReview(null, rubric.id, review([first.id]))

        await expect(service.deleteCriterion(first.id)).rejects.toThrow(
          /used by a review score/,
        )
        expect(
          await service.listCriteria({ rubric_id: rubric.id }),
        ).toHaveLength(2)
        await service.deleteCriterion(second.id)
        expect(
          await service.listCriteria({ rubric_id: rubric.id }),
        ).toHaveLength(1)
      })

      it("refuses an unknown criterion", async () => {
        await expect(service.deleteCriterion("rvcrit_missing")).rejects.toThrow(
          /rvcrit_missing/,
        )
      })
    })

    describe("upsertReview", () => {
      it("creates a review with trimmed texts and its scores", async () => {
        const rubric = await rubricOf("Potencia", "Portabilidad")
        const ids = rubric.criteria.map(({ id }) => id)

        const created = await service.upsertReview(
          null,
          rubric.id,
          review(ids, { verdict: "  Buen cargador.  " }),
        )

        expect(created.id).toMatch(/^exrev_/)
        const found = await service.getReview(created.id)
        expect(found.verdict).toBe("Buen cargador.")
        expect(found.rubric_id).toBe(rubric.id)
        expect(found.scores).toHaveLength(2)
      })

      it("refuses input that F1 expertReviewSchema refuses, creating nothing", async () => {
        const rubric = await rubricOf("Potencia")
        const [criterion] = rubric.criteria

        await expect(
          service.upsertReview(
            null,
            rubric.id,
            review([criterion.id], { verdict: "a".repeat(241) }),
          ),
        ).rejects.toThrow("verdict must be at most 240 characters")
        await expect(
          service.upsertReview(
            null,
            rubric.id,
            review([criterion.id], { for_whom: [] }),
          ),
        ).rejects.toThrow("for_whom needs at least one item")
        await expect(
          service.upsertReview(null, rubric.id, review([])),
        ).rejects.toThrow("scores needs at least one item")
        expect(await service.listExpertReviews()).toHaveLength(0)
      })

      it("refuses a score from a criterion of another rubric", async () => {
        const rubric = await rubricOf("Potencia")
        const other = await rubricOf("Sonido")

        await expect(
          service.upsertReview(null, rubric.id, review([other.criteria[0].id])),
        ).rejects.toThrow(/does not belong to the review's rubric/)
        expect(await service.listExpertReviews()).toHaveLength(0)
        expect(await service.listRubricScores()).toHaveLength(0)
      })

      it("refuses an unknown rubric", async () => {
        await expect(
          service.upsertReview(null, "rvrub_missing", review(["rvcrit_x"])),
        ).rejects.toThrow(/rvrub_missing/)
      })

      it("refuses an unknown review", async () => {
        const rubric = await rubricOf("Potencia")

        await expect(
          service.upsertReview(
            "exrev_missing",
            rubric.id,
            review([rubric.criteria[0].id]),
          ),
        ).rejects.toThrow(/exrev_missing/)
      })

      it("replaces the content and scores of an existing review", async () => {
        const rubric = await rubricOf("Potencia", "Portabilidad")
        const ids = rubric.criteria.map(({ id }) => id)
        const created = await service.upsertReview(null, rubric.id, review(ids))

        const updated = await service.upsertReview(
          created.id,
          rubric.id,
          review([ids[1]], {
            verdict: "Otro veredicto.",
            for_whom: ["A", "B"],
          }),
        )

        expect(updated.id).toBe(created.id)
        const found = await service.getReview(created.id)
        expect(found.verdict).toBe("Otro veredicto.")
        expect(found.for_whom).toEqual(["A", "B"])
        expect(found.scores.map(({ criterion_id }) => criterion_id)).toEqual([
          ids[1],
        ])
        expect(await service.listExpertReviews()).toHaveLength(1)
      })

      // Makes the next call of `method` fail. The service under test calls its
      // own generated methods through the prototype, so the failure goes there.
      const failOnce = (method: "createRubricScores" | "createCriteria") => {
        const prototype = EditorialModuleService.prototype as unknown as Record<
          string,
          unknown
        >
        prototype[method] = async () => {
          delete prototype[method]
          throw new Error("database went away")
        }
        return () => {
          delete prototype[method]
        }
      }

      it("rolls back the whole update when saving the scores fails", async () => {
        const rubric = await rubricOf("Potencia", "Portabilidad")
        const ids = rubric.criteria.map(({ id }) => id)
        const created = await service.upsertReview(null, rubric.id, review(ids))
        const restore = failOnce("createRubricScores")

        try {
          await expect(
            service.upsertReview(
              created.id,
              rubric.id,
              review([ids[0]], { verdict: "Nuevo." }),
            ),
          ).rejects.toThrow("database went away")
        } finally {
          restore()
        }

        const found = await service.getReview(created.id)
        expect(found.verdict).toBe("Buen cargador.")
        expect(found.scores.map(({ criterion_id }) => criterion_id)).toEqual(
          ids,
        )
      })

      it("rolls back a new rubric when saving its criteria fails", async () => {
        const restore = failOnce("createCriteria")

        try {
          await expect(
            service.createRubric([{ name: "Potencia", rank: 0 }]),
          ).rejects.toThrow("database went away")
        } finally {
          restore()
        }

        expect(await service.listReviewRubrics()).toHaveLength(0)
      })

      it("keeps the old content when an update is refused", async () => {
        const rubric = await rubricOf("Potencia")
        const [criterion] = rubric.criteria
        const created = await service.upsertReview(
          null,
          rubric.id,
          review([criterion.id]),
        )

        await expect(
          service.upsertReview(
            created.id,
            rubric.id,
            review(["rvcrit_other"], { verdict: "Nuevo." }),
          ),
        ).rejects.toThrow()

        const found = await service.getReview(created.id)
        expect(found.verdict).toBe("Buen cargador.")
        expect(found.scores).toHaveLength(1)
      })
    })

    describe("getReview", () => {
      it("returns the review with scores in criterion rank order", async () => {
        const rubric = await service.createRubric([
          { name: "Tercero", rank: 2 },
          { name: "Primero", rank: 0 },
          { name: "Segundo", rank: 1 },
        ])
        const byName = Object.fromEntries(
          rubric.criteria.map((criterion) => [criterion.name, criterion.id]),
        )
        // Scored out of rank order on purpose.
        const created = await service.upsertReview(
          null,
          rubric.id,
          review([byName.Tercero, byName.Primero, byName.Segundo]),
        )

        const found = await service.getReview(created.id)

        expect(found).toEqual({
          id: created.id,
          rubric_id: rubric.id,
          verdict: "Buen cargador.",
          for_whom: ["Quien viaja"],
          not_for: ["Quien busca lo más barato"],
          scores: [
            {
              criterion_id: byName.Primero,
              criterion: "Primero",
              rank: 0,
              score: 2,
              note: "Nota 2.",
            },
            {
              criterion_id: byName.Segundo,
              criterion: "Segundo",
              rank: 1,
              score: 3,
              note: "Nota 3.",
            },
            {
              criterion_id: byName.Tercero,
              criterion: "Tercero",
              rank: 2,
              score: 1,
              note: "Nota 1.",
            },
          ],
        })
      })

      it("refuses an unknown review", async () => {
        await expect(service.getReview("exrev_missing")).rejects.toThrow(
          /exrev_missing/,
        )
      })
    })
  },
})
