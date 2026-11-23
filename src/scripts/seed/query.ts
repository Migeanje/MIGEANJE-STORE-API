import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * `query.graph` rows typed by the caller. Medusa types the rows of core
 * entities only, so fields read through a module link (`spec_schema.id`,
 * `transit_time.min_days`...) need the caller to state their shape.
 */
export async function graphRows<T>(
  container: MedusaContainer,
  entity: string,
  fields: string[],
  filters?: Record<string, unknown>,
): Promise<T[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity,
    fields,
    ...(filters && { filters }),
  })
  return data as unknown as T[]
}
