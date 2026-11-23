import { model } from "@medusajs/framework/utils"
import SpecSchema from "./spec-schema"
import SpecValue from "./spec-value"

/** The spec values of one product, linked to it one-to-one. */
const ProductSpecSheet = model
  .define("product_spec_sheet", {
    id: model.id({ prefix: "specsheet" }).primaryKey(),
    /** The schema of the product's category when the sheet was written. */
    schema: model.belongsTo(() => SpecSchema, { mappedBy: "sheets" }),
    /** A product may omit any spec (F1). */
    values: model.hasMany(() => SpecValue, { mappedBy: "sheet" }),
  })
  .cascades({ delete: ["values"] })

export default ProductSpecSheet
