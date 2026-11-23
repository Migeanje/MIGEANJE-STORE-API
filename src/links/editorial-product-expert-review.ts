import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import EditorialModule from "../modules/editorial"

// One review per product (one-to-one). Deleting the product deletes its review.
export default defineLink(ProductModule.linkable.product, {
  linkable: EditorialModule.linkable.expertReview,
  deleteCascade: true,
})
