import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { snapshot } from "../../src/scripts/seed/__tests__/support"
import {
  failures,
  runAppleCheck,
  runCounts,
} from "../../src/scripts/seed/check"
import { LAYERS } from "../../src/scripts/seed/layers"
import { graphRows } from "../../src/scripts/seed/query"
import { runSeed } from "../../src/scripts/seed/run"

jest.setTimeout(600 * 1000)

const development = {
  nodeEnv: "development",
  env: { SEED_DEMO_PASSWORD: "demo-password-for-tests" },
  regime: "nrus" as const,
}

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("seed, all layers", () => {
      it("runs twice: the second run creates nothing and changes nothing", async () => {
        const container = getContainer()
        await runSeed(container, [], development)
        const before = await snapshot(container)

        await runSeed(container, [], development)

        expect(await snapshot(container)).toEqual(before)
      })

      it("passes the post-seed check: every count of docs/seed-plan.md and the Apple line", async () => {
        const container = getContainer()
        await runSeed(container, [], development)

        const results = [
          ...(await runCounts(container, LAYERS, "nrus")),
          ...(await runAppleCheck(container)),
        ]

        expect(failures(results)).toEqual([])
        // Only what depends on modules that do not exist yet is skipped.
        expect(
          results
            .filter((result) => result.status === "skipped")
            .map((result) => result.name)
            .sort(),
        ).toEqual(
          [
            "Region payment provider pp_culqi_culqi",
            "Demo supplier and 7 offers",
            "Demo favorites",
            "No supplier offer on an Apple variant",
            "variantAvailability is unavailable with max_quantity 0",
          ].sort(),
        )
      })

      it("rejects an unknown layer before writing anything", async () => {
        const container = getContainer()
        const before = await snapshot(container)

        await expect(
          runSeed(container, ["setup", "nope"], development),
        ).rejects.toThrow(
          "Unknown seed layer: nope. Layers: reference, setup, catalog, demo.",
        )

        expect(await snapshot(container)).toEqual(before)
      })

      it("refuses a run that includes the demo layer in production before writing anything", async () => {
        const container = getContainer()
        const before = await snapshot(container)

        await expect(
          runSeed(container, [], { ...development, nodeEnv: "production" }),
        ).rejects.toThrow(/production/)

        expect(await snapshot(container)).toEqual(before)
      })

      it("runs without the demo layer in production", async () => {
        const container = getContainer()

        await runSeed(container, ["reference", "setup", "catalog"], {
          nodeEnv: "production",
          env: {},
        })

        const results = await runCounts(
          container,
          ["reference", "setup", "catalog"],
          "nrus",
        )
        expect(failures(results)).toEqual([])
        expect(
          await container.resolve(Modules.CUSTOMER).listCustomers({}),
        ).toEqual([])
      })

      it("fails the run on an Apple variant that could be bought, lists it, and never repairs it", async () => {
        const container = getContainer()
        await runSeed(container, ["reference", "setup", "catalog"], development)
        const variants = await graphRows<{ id: string; sku: string }>(
          container,
          "product_variant",
          ["id", "sku"],
          { sku: "APL-MFHP4" },
        )
        const product = container.resolve(Modules.PRODUCT)
        await product.updateProductVariants(variants[0].id, {
          allow_backorder: true,
        })

        const check = await runAppleCheck(container)
        expect(failures(check)).toEqual([
          expect.objectContaining({
            detail: expect.stringContaining("APL-MFHP4"),
          }),
        ])

        await expect(
          runSeed(container, ["catalog"], development),
        ).rejects.toThrow(/APL-MFHP4/)
        const [after] = await product.listProductVariants({ sku: "APL-MFHP4" })
        expect(after.allow_backorder).toBe(true)
      })
    })
  },
})
