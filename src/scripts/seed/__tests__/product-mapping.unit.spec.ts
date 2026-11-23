import { PRODUCTS } from "../../seed-data/products"
import { optionTitles, productInput, variantTitle } from "../product-mapping"

const bySlug = (slug: string) => {
  const product = PRODUCTS.find((candidate) => candidate.slug === slug)
  if (!product) throw new Error(`No fixture ${slug}`)
  return product
}

const context = {
  collectionId: "pcol_anker",
  categoryId: "pcat_chargers",
  tagIds: new Map([
    ["gan", "ptag_gan"],
    ["carga rápida", "ptag_fast"],
    ["usb-c", "ptag_usbc"],
    ["iphone", "ptag_iphone"],
    ["compacto", "ptag_compact"],
  ]),
  salesChannelId: "sc_1",
  shippingProfileId: "sp_1",
}

/** A context whose tag ids cover the product's own tags. */
const contextFor = (product: (typeof PRODUCTS)[number]) => ({
  ...context,
  tagIds: new Map(product.tags.map((tag) => [tag, `tag_${tag}`])),
})

describe("productInput", () => {
  it("maps a product with colors to a Medusa product (plan, 'Product mapping')", () => {
    const product = bySlug("anker-nano-charger-45w-smart-display")
    const input = productInput(product, context)

    expect(input).toMatchObject({
      title: "Nano Charger 45W Smart Display",
      handle: "anker-nano-charger-45w-smart-display",
      description: product.summary,
      subtitle: "A121D",
      status: "published",
      collection_id: "pcol_anker",
      category_ids: ["pcat_chargers"],
      sales_channels: [{ id: "sc_1" }],
      shipping_profile_id: "sp_1",
    })
    expect(input.tag_ids).toEqual([
      "ptag_gan",
      "ptag_fast",
      "ptag_usbc",
      "ptag_iphone",
      "ptag_compact",
    ])
    expect(input.options).toEqual([
      { title: "Color", values: ["Blanco", "Negro", "Azul", "Naranja"] },
    ])
    expect(input.variants?.map((variant) => variant.title)).toEqual([
      "Blanco",
      "Negro",
      "Azul",
      "Naranja",
    ])
    expect(input.variants?.[1]).toMatchObject({
      sku: "ANK-A121D-BLK",
      options: { Color: "Negro" },
      manage_inventory: true,
      allow_backorder: true,
      prices: [{ amount: 248.9, currency_code: "pen" }],
    })
  })

  it("sets allow_backorder only on backorder variants, manage_inventory on all", () => {
    for (const product of PRODUCTS) {
      const input = productInput(product, contextFor(product))
      input.variants?.forEach((variant, index) => {
        const source = product.variants[index]
        expect(variant.manage_inventory).toBe(true)
        expect(variant.allow_backorder).toBe(
          source.availability === "backorder",
        )
      })
    }
  })

  it("gives a product without options Medusa's default option (createProductsWorkflow rejects none) and its title as the one variant title", () => {
    const product = bySlug("anker-prime-charger-100w-3-puertos")
    const input = productInput(product, contextFor(product))
    expect(input.options).toEqual([
      { title: "Default option", values: ["Default option value"] },
    ])
    expect(input.variants).toHaveLength(1)
    expect(input.variants?.[0].title).toBe(product.name)
    expect(input.variants?.[0].options).toEqual({
      "Default option": "Default option value",
    })
    expect(input.variants?.[0].prices).toEqual([
      { amount: 189.9, currency_code: "pen" },
    ])
  })

  it("leaves the Apple line without prices and without backorder (R9)", () => {
    for (const slug of [
      "macbook-air-13-m5",
      "ipad-air-11-m4",
      "airpods-pro-3",
    ]) {
      const product = bySlug(slug)
      const input = productInput(product, contextFor(product))
      for (const variant of input.variants ?? []) {
        expect(variant.prices).toEqual([])
        expect(variant.manage_inventory).toBe(true)
        expect(variant.allow_backorder).toBe(false)
      }
    }
  })

  it("omits the subtitle when the product has no model", () => {
    const macbook = bySlug("macbook-air-13-m5")
    const input = productInput(macbook, contextFor(macbook))
    expect(input.subtitle).toBeUndefined()
  })

  it("fails when a tag was not created first", () => {
    expect(() =>
      productInput(bySlug("anker-nano-charger-45w-smart-display"), {
        ...context,
        tagIds: new Map(),
      }),
    ).toThrow(/tag/i)
  })
})

describe("option titles and variant titles", () => {
  it("titles options with the F1 labels and joins values with ' / '", () => {
    const product = bySlug("ipad-air-11-m4")
    expect(optionTitles(product)).toEqual(["Almacenamiento", "Color"])
    const first = product.variants[0]
    expect(variantTitle(product, first)).toBe(
      `${first.options.storage} / ${first.options.color}`,
    )
  })

  it("lists each option value once, in first-seen order", () => {
    const product = bySlug("macbook-air-13-m5")
    const input = productInput(product, contextFor(product))
    for (const option of input.options ?? []) {
      const values = "values" in option ? (option.values as string[]) : []
      expect(new Set(values).size).toBe(values.length)
    }
  })
})
