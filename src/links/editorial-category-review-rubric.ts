import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import EditorialModule from "../modules/editorial"

// One rubric per product category (one-to-one). No cascade (proposed): deleting
// a category keeps its rubric for the owner to clean up.
export default defineLink(
  ProductModule.linkable.productCategory,
  EditorialModule.linkable.reviewRubric,
)
