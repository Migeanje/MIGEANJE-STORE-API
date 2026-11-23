import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { Regime } from "../../config/regime"
import { seedCatalog } from "./catalog"
import { assertNoFailures, report, runAppleCheck } from "./check"
import { seedDemo } from "./demo"
import {
  assertDemoAllowed,
  demoPassword,
  type Layer,
  parseLayers,
} from "./layers"
import { seedReference } from "./reference"
import { seedSetup } from "./setup"

export type RunOptions = {
  /** Defaults to `process.env.NODE_ENV`. */
  nodeEnv?: string
  /** Defaults to `process.env`. */
  env?: Record<string, string | undefined>
  regime?: Regime
}

export type RunResult = { layers: Layer[] }

/**
 * Runs the seed layers named in `args` (all of them without arguments), in
 * seed order. The arguments and the demo layer's preconditions are checked
 * before anything is written, so a refused run leaves no half seed. After
 * the catalog layer the Apple line check runs and fails the run on any
 * offending variant.
 */
export async function runSeed(
  container: MedusaContainer,
  args: readonly string[],
  options: RunOptions = {},
): Promise<RunResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const layers = parseLayers(args)

  if (layers.includes("demo")) {
    assertDemoAllowed(options.nodeEnv ?? process.env.NODE_ENV)
    demoPassword(options.env ?? process.env)
  }

  if (layers.includes("reference")) {
    const reference = await seedReference(container)
    logger.info(
      `Seed reference layer: ${reference.created} created, ${reference.updated} updated.`,
    )
  }
  if (layers.includes("setup")) {
    const setup = await seedSetup(container, { regime: options.regime })
    logger.info(
      `Seed setup layer: region ${setup.regionId}, sales channel ${setup.salesChannelId}, stock location ${setup.stockLocationId}.`,
    )
  }
  if (layers.includes("catalog")) {
    const catalog = await seedCatalog(container)
    logger.info(
      `Seed catalog layer created: ${JSON.stringify(catalog.created)}.`,
    )

    const apple = await runAppleCheck(container)
    logger.info(`Apple line check:\n${report(apple)}`)
    assertNoFailures(apple, "The Apple line check")
  }
  if (layers.includes("demo")) {
    const demo = await seedDemo(container, options)
    logger.info(`Seed demo layer created: ${JSON.stringify(demo.created)}.`)
  }
  return { layers }
}
