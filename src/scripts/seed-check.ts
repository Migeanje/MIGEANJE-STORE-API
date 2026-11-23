import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  assertNoFailures,
  report,
  runAppleCheck,
  runCounts,
} from "./seed/check"
import { parseLayers } from "./seed/layers"

/**
 * Read-only seed check (docs/seed-plan.md, "Post-seed verification"): the
 * counts of each layer and the Apple line check. It exits non-zero when a
 * check fails and never repairs.
 *   pnpm medusa exec ./src/scripts/seed-check.ts
 * checks every layer, or only those named; without arguments in production
 * the demo layer is left out, as the seed leaves it out.
 */
export default async function seedCheck({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const layers = parseLayers(args).filter(
    (layer) =>
      !(
        args.length === 0 &&
        layer === "demo" &&
        process.env.NODE_ENV === "production"
      ),
  )
  const results = [
    ...(await runCounts(container, layers)),
    ...(layers.includes("catalog") ? await runAppleCheck(container) : []),
  ]

  logger.info(`Seed check (${layers.join(", ")}):\n${report(results)}`)
  assertNoFailures(results, "The seed check")
}
