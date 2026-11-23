import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import SpecsModule from "../modules/specs"

// One spec sheet per product. A sheet means nothing without its product, so
// deleting the product deletes the sheet (docs/data-model/specs.md).
export default defineLink(ProductModule.linkable.product, {
  linkable: SpecsModule.linkable.productSpecSheet,
  deleteCascade: true,
})
