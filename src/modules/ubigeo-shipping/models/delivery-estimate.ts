import { model } from "@medusajs/framework/utils"
import { SHIPPING_ZONES } from "../domain/shipping-zone"

const DATE_FORMAT = "'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'"

/**
 * What the store promised when the order was placed. A snapshot: later
 * changes to transit times or holidays never move a promised date. Dates are
 * Lima calendar dates; YYYY-MM-DD text compares in date order.
 */
const DeliveryEstimate = model
  .define("delivery_estimate", {
    id: model.id({ prefix: "dlvest" }).primaryKey(),
    zone: model.enum([...SHIPPING_ZONES]),
    transit_min_days: model.number(),
    transit_max_days: model.number(),
    lead_time_min_days: model.number().nullable(),
    lead_time_max_days: model.number().nullable(),
    delivery_from: model.text(),
    delivery_to: model.text(),
  })
  .checks([
    {
      name: "delivery_estimate_transit_min_days_non_negative",
      expression: (columns) => `${columns.transit_min_days} >= 0`,
    },
    {
      name: "delivery_estimate_transit_max_gte_min",
      expression: (columns) =>
        `${columns.transit_max_days} >= ${columns.transit_min_days}`,
    },
    {
      name: "delivery_estimate_lead_time_both_or_neither",
      expression: (columns) =>
        `(${columns.lead_time_min_days} IS NULL) = (${columns.lead_time_max_days} IS NULL)`,
    },
    {
      name: "delivery_estimate_lead_time_max_gte_min",
      expression: (columns) =>
        `${columns.lead_time_max_days} >= ${columns.lead_time_min_days}`,
    },
    {
      name: "delivery_estimate_delivery_from_format",
      expression: (columns) => `${columns.delivery_from} ~ ${DATE_FORMAT}`,
    },
    {
      name: "delivery_estimate_delivery_to_format",
      expression: (columns) => `${columns.delivery_to} ~ ${DATE_FORMAT}`,
    },
    {
      name: "delivery_estimate_delivery_to_gte_from",
      expression: (columns) =>
        `${columns.delivery_to} COLLATE "C" >= ${columns.delivery_from} COLLATE "C"`,
    },
  ])

export default DeliveryEstimate
