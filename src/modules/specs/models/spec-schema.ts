import { model } from "@medusajs/framework/utils"
import ProductSpecSheet from "./product-spec-sheet"
import SpecDefinition from "./spec-definition"

/**
 * The spec list of one category (F1 `Category.specSchema`), linked to a
 * product category. It keeps at least one definition (service rule).
 */
const SpecSchema = model.define("spec_schema", {
  id: model.id({ prefix: "specsch" }).primaryKey(),
  definitions: model.hasMany(() => SpecDefinition, { mappedBy: "schema" }),
  sheets: model.hasMany(() => ProductSpecSheet, { mappedBy: "schema" }),
})

export default SpecSchema
