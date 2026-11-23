import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EDITORIAL_MODULE } from "../../../modules/editorial"
import { SPECS_MODULE } from "../../../modules/specs"
import { UBIGEO_SHIPPING_MODULE } from "../../../modules/ubigeo-shipping"

/** Shared helpers of the seed integration specs (not a spec itself). */

/** Query entities whose rows a second seed run must neither add nor touch. */
const ENTITIES = [
  "store",
  "sales_channel",
  "region",
  "tax_region",
  "price_preference",
  "stock_location",
  "fulfillment_set",
  "service_zone",
  "geo_zone",
  "shipping_profile",
  "shipping_option",
  "api_key",
  "refund_reason",
  "product_category",
  "product_collection",
  "product_tag",
  "product",
  "product_variant",
  "inventory_item",
  "inventory_level",
  "customer",
  "customer_address",
] as const

type Row = { id: string; updated_at?: string | Date | null }

const stamp = (row: Row) => `${row.id}@${String(row.updated_at ?? "")}`

/** Every row of the seeded entities and of the custom modules, as `id@updated_at`. */
export async function snapshot(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const result: Record<string, string[]> = {}

  for (const entity of ENTITIES) {
    const { data } = await query.graph({
      entity,
      fields: ["id", "updated_at"],
    })
    result[entity] = (data as Row[]).map(stamp).sort()
  }

  const ubigeo = container.resolve(UBIGEO_SHIPPING_MODULE) as unknown as Record<
    string,
    (...args: unknown[]) => Promise<Row[]>
  >
  for (const list of [
    "listUbigeoDepartamentos",
    "listUbigeoProvincias",
    "listUbigeoDistritos",
    "listHolidays",
    "listTransitTimes",
  ]) {
    result[list] = (await ubigeo[list]({}, { take: null })).map(stamp).sort()
  }
  const specs = container.resolve(SPECS_MODULE) as unknown as Record<
    string,
    (...args: unknown[]) => Promise<Row[]>
  >
  for (const list of [
    "listSpecSchemas",
    "listSpecDefinitions",
    "listProductSpecSheets",
    "listSpecValues",
  ]) {
    result[list] = (await specs[list]({}, { take: null })).map(stamp).sort()
  }
  const editorial = container.resolve(EDITORIAL_MODULE) as unknown as Record<
    string,
    (...args: unknown[]) => Promise<Row[]>
  >
  for (const list of [
    "listReviewRubrics",
    "listCriteria",
    "listExpertReviews",
    "listRubricScores",
  ]) {
    result[list] = (await editorial[list]({}, { take: null })).map(stamp).sort()
  }
  return result
}

/** Row counts by entity, for readable assertions. */
export async function counts(container: MedusaContainer) {
  return Object.fromEntries(
    Object.entries(await snapshot(container)).map(([key, rows]) => [
      key,
      rows.length,
    ]),
  )
}
