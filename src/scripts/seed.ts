import type { ExecArgs } from "@medusajs/framework/types"
import { runSeed } from "./seed/run"

/**
 * Idempotent seed (docs/seed-plan.md). Run every layer:
 *   pnpm medusa exec ./src/scripts/seed.ts
 * or only some; they always run in this order: reference, setup, catalog, demo:
 *   pnpm medusa exec ./src/scripts/seed.ts reference setup catalog
 *
 * The demo layer refuses to run when NODE_ENV is production, and needs the
 * SEED_DEMO_PASSWORD environment variable (8 to 128 characters).
 */
export default async function seed({ container, args }: ExecArgs) {
  await runSeed(container, args)
}
