import { model } from "@medusajs/framework/utils"

/**
 * A non-working day that delivery estimates skip (decision D11). `date` is a
 * Lima calendar date, not an instant, so it is text and not `dateTime`.
 */
const Holiday = model
  .define("holiday", {
    id: model.id({ prefix: "hday" }).primaryKey(),
    date: model.text().unique(),
    name: model.text(),
  })
  .checks([
    {
      name: "holiday_date_format",
      expression: (columns) =>
        `${columns.date} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
    },
    {
      name: "holiday_name_not_blank",
      expression: (columns) => `${columns.name} ~ '[^[:space:]]'`,
    },
  ])

export default Holiday
