import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { seedSetup } from "./seed/setup"

/**
 * Idempotent seed (docs/seed-plan.md). Run every layer:
 *   pnpm medusa exec ./src/scripts/seed.ts
 * or only some, in this order:
 *   pnpm medusa exec ./src/scripts/seed.ts setup
 *
 * F3a T4 delivers the setup layer; the reference, catalog and demo layers
 * come with T8.
 */
const LAYERS = ["setup"] as const
type Layer = (typeof LAYERS)[number]

const isLayer = (value: string): value is Layer =>
  (LAYERS as readonly string[]).includes(value)

export default async function seed({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const unknown = args.filter((arg) => !isLayer(arg))
  if (unknown.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_ARGUMENT,
      `Unknown seed layer: ${unknown.join(", ")}. Layers: ${LAYERS.join(", ")}.`,
    )
  }
  const layers = args.length
    ? LAYERS.filter((layer) => args.includes(layer))
    : LAYERS

  if (layers.includes("setup")) {
    const setup = await seedSetup(container)
    logger.info(
      `Seed setup layer: region ${setup.regionId}, sales channel ${setup.salesChannelId}, stock location ${setup.stockLocationId}.`,
    )
  }
}
