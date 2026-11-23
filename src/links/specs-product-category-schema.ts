import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import SpecsModule from "../modules/specs"

// One spec schema per product category. No cascade: deleting a category keeps
// its schema for the owner to clean up (docs/data-model/specs.md).
export default defineLink(
  ProductModule.linkable.productCategory,
  SpecsModule.linkable.specSchema,
)
