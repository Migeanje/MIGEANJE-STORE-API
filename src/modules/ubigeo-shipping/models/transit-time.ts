import { model } from "@medusajs/framework/utils"
import { SHIPPING_ZONES } from "../domain/shipping-zone"

/** The courier's time, in business days, for one shipping option. */
const TransitTime = model
  .define("transit_time", {
    id: model.id({ prefix: "trtime" }).primaryKey(),
    zone: model.enum([...SHIPPING_ZONES]),
    min_days: model.number(),
    max_days: model.number(),
  })
  .checks([
    {
      name: "transit_time_min_days_non_negative",
      expression: (columns) => `${columns.min_days} >= 0`,
    },
    {
      name: "transit_time_max_days_gte_min_days",
      expression: (columns) => `${columns.max_days} >= ${columns.min_days}`,
    },
  ])

export default TransitTime
