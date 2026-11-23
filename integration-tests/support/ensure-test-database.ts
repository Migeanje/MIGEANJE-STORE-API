import { TestDatabaseUtils } from "@medusajs/test-utils"

/**
 * Creates the database `moduleIntegrationTestRunner` uses for this module
 * and Jest worker. The runner relies on MikroORM to create it, and MikroORM
 * detects a missing database by its English error text, so it fails on a
 * PostgreSQL server with another locale (the owner's is Spanish). Creating it
 * first is harmless where the runner would have created it anyway.
 */
export function ensureTestDatabase(moduleName: string): void {
  beforeAll(async () => {
    const worker = process.env.JEST_WORKER_ID ?? "1"
    await TestDatabaseUtils.dbTestUtilFactory().create(
      `medusa-${moduleName}-integration-${worker}`,
    )
  })
}
