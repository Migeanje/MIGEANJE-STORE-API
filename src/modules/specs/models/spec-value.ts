import { model } from "@medusajs/framework/utils"
import ProductSpecSheet from "./product-spec-sheet"
import SpecDefinition from "./spec-definition"

/**
 * One value of one spec for one product (F1 `SpecValue`). Typed columns let
 * the module filter in SQL; the definition's kind decides the column.
 */
const SpecValue = model
  .define("spec_value", {
    id: model.id({ prefix: "specval" }).primaryKey(),
    sheet: model.belongsTo(() => ProductSpecSheet, { mappedBy: "values" }),
    /** Same schema as the sheet (service rule). */
    definition: model.belongsTo(() => SpecDefinition, { mappedBy: "values" }),
    /** Kind `number`; finite (service rule). Specs have decimals: 13.6. */
    number_value: model.float().nullable(),
    /** Kind `text`; not blank (service rule). */
    text_value: model.text().nullable(),
    /** Kind `boolean`. The storefront shows "Sí" / "No". */
    boolean_value: model.boolean().nullable(),
    /** Kind `list`; at least one item, distinct, not blank (service rule). */
    list_value: model.array().nullable(),
  })
  .indexes([{ on: ["sheet_id", "definition_id"], unique: true }])
  .checks([
    {
      name: "spec_value_exactly_one_column",
      expression: (columns) =>
        `num_nonnulls(${columns.number_value}, ${columns.text_value}, ${columns.boolean_value}, ${columns.list_value}) = 1`,
    },
  ])

export default SpecValue
