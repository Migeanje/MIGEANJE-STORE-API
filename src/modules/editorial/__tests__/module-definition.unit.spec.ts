import ProductModule from "@medusajs/medusa/product"
import EditorialModule, { EDITORIAL_MODULE } from ".."

// The module links in src/links/editorial-*.ts rely on these linkable keys.
describe("editorial module definition", () => {
  it("uses a module name Medusa accepts", () => {
    expect(EDITORIAL_MODULE).toBe("editorial")
    expect(EDITORIAL_MODULE).toMatch(/^[a-zA-Z_][0-9a-zA-Z_]*$/)
  })

  it("exposes expert_review and review_rubric as linkables", () => {
    expect(EditorialModule.linkable.expertReview.toJSON()).toEqual(
      expect.objectContaining({
        serviceName: EDITORIAL_MODULE,
        linkable: "expert_review_id",
        primaryKey: "id",
      }),
    )
    expect(EditorialModule.linkable.reviewRubric.toJSON()).toEqual(
      expect.objectContaining({
        serviceName: EDITORIAL_MODULE,
        linkable: "review_rubric_id",
        primaryKey: "id",
      }),
    )
  })

  it("links to the Product Module's product and productCategory keys", () => {
    expect(ProductModule.linkable.product.toJSON()).toEqual(
      expect.objectContaining({ linkable: "product_id", primaryKey: "id" }),
    )
    expect(ProductModule.linkable.productCategory.toJSON()).toEqual(
      expect.objectContaining({
        linkable: "product_category_id",
        primaryKey: "id",
      }),
    )
  })
})
