import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  updateInventoryLevelsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { EDITORIAL_MODULE } from "../../src/modules/editorial"
import type EditorialModuleService from "../../src/modules/editorial/service"
import { SPECS_MODULE } from "../../src/modules/specs"
import type SpecsModuleService from "../../src/modules/specs/service"
import { snapshot } from "../../src/scripts/seed/__tests__/support"
import { seedCatalog } from "../../src/scripts/seed/catalog"
import { graphRows } from "../../src/scripts/seed/query"
import { seedSetup } from "../../src/scripts/seed/setup"
import { PRODUCTS } from "../../src/scripts/seed-data/products"

jest.setTimeout(300 * 1000)

const APPLE_SLUGS = ["macbook-air-13-m5", "ipad-air-11-m4", "airpods-pro-3"]

const variantRows = async (container: MedusaContainer) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "sku",
      "manage_inventory",
      "allow_backorder",
      "product.handle",
      "price_set.prices.amount",
      "price_set.prices.currency_code",
    ],
  })
  return data
}

const seedAll = async (container: MedusaContainer) => {
  const setup = await seedSetup(container, { regime: "nrus" })
  await seedCatalog(container)
  return setup
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("seed catalog layer", () => {
      it("creates 9 active categories, 4 brand collections and the product tags", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        await seedAll(container)

        const { data: categories } = await query.graph({
          entity: "product_category",
          fields: ["handle", "name", "is_active"],
        })
        expect(categories.map((category) => category.handle).sort()).toEqual(
          [
            "almacenamiento",
            "audio",
            "cables",
            "cargadores",
            "carga-inalambrica",
            "hubs-y-docks",
            "laptops",
            "power-banks",
            "tablets",
          ].sort(),
        )
        expect(categories.every((category) => category.is_active)).toBe(true)
        expect(
          categories.find((category) => category.handle === "cargadores")?.name,
        ).toBe("Cargadores")

        const { data: collections } = await query.graph({
          entity: "product_collection",
          fields: ["handle", "title"],
        })
        expect(
          collections.map(({ handle, title }) => [handle, title]).sort(),
        ).toEqual(
          [
            ["anker", "Anker"],
            ["ugreen", "UGREEN"],
            ["soundcore", "Soundcore"],
            ["apple", "Apple"],
          ].sort(),
        )

        const { data: tags } = await query.graph({
          entity: "product_tag",
          fields: ["value"],
        })
        const expected = new Set(PRODUCTS.flatMap((product) => product.tags))
        expect(tags.map((tag) => tag.value).sort()).toEqual(
          [...expected].sort(),
        )
      })

      it("creates 19 published products in the sales channel, each in one category and one collection", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const setup = await seedSetup(container, { regime: "nrus" })
        await seedCatalog(container)

        const { data: products } = await query.graph({
          entity: "product",
          fields: [
            "handle",
            "title",
            "subtitle",
            "description",
            "status",
            "created_at",
            "collection.handle",
            "categories.handle",
            "tags.value",
            "sales_channels.id",
            "shipping_profile.id",
          ],
        })
        expect(products).toHaveLength(19)
        for (const product of products) {
          const source = PRODUCTS.find((p) => p.slug === product.handle)
          expect(source).toBeDefined()
          expect(product).toMatchObject({
            title: source?.name,
            description: source?.summary,
            status: "published",
            collection: { handle: source?.brand },
            shipping_profile: { id: setup.shippingProfileId },
          })
          expect(product.subtitle ?? undefined).toBe(source?.model)
          expect(product.categories?.map((c) => c?.handle)).toEqual([
            source?.category,
          ])
          expect(product.sales_channels?.map((sc) => sc?.id)).toEqual([
            setup.salesChannelId,
          ])
          expect(product.tags.map((tag) => tag?.value).sort()).toEqual(
            [...(source?.tags ?? [])].sort(),
          )
        }
      })

      it("keeps the F1 featured order in the creation order", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        await seedAll(container)

        const { data } = await query.graph({
          entity: "product",
          fields: ["handle", "created_at"],
        })
        const byCreation = [...data]
          .sort(
            (a, b) =>
              new Date(a.created_at as string).getTime() -
              new Date(b.created_at as string).getTime(),
          )
          .map((product) => product.handle)
        expect(byCreation).toEqual(PRODUCTS.map((product) => product.slug))
      })

      it("creates 56 variants: all managed, 7 on backorder, 31 with a PEN price in major units", async () => {
        const container = getContainer()
        await seedAll(container)

        const variants = await variantRows(container)
        expect(variants).toHaveLength(56)
        expect(variants.every((variant) => variant.manage_inventory)).toBe(true)
        expect(
          variants.filter((variant) => variant.allow_backorder),
        ).toHaveLength(7)
        const priced = variants.filter(
          (variant) => (variant.price_set?.prices ?? []).length > 0,
        )
        expect(priced).toHaveLength(31)

        const priceOf = (sku: string) =>
          variants
            .find((variant) => variant.sku === sku)
            ?.price_set?.prices.map((price) => [
              price?.currency_code,
              Number(price?.amount),
            ])
        expect(priceOf("ANK-A2688")).toEqual([["pen", 189.9]])
        expect(priceOf("ANK-A121D-BLK")).toEqual([["pen", 248.9]])
        const nas = PRODUCTS.find(
          (p) => p.slug === "ugreen-nasync-dxp4800-plus",
        )
        expect(priceOf(nas?.variants[0].sku as string)).toEqual([
          ["pen", 3499.9],
        ])
      })

      it("leaves the Apple line visible and never purchasable: no price, no stock, no backorder", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        await seedAll(container)

        const { data: products } = await query.graph({
          entity: "product",
          fields: ["handle", "status", "collection.handle"],
          filters: { handle: APPLE_SLUGS },
        })
        expect(products.map((p) => p.handle).sort()).toEqual(
          [...APPLE_SLUGS].sort(),
        )
        const { data: collection } = await query.graph({
          entity: "product_collection",
          fields: ["handle", "products.handle"],
          filters: { handle: "apple" },
        })
        expect(
          collection[0].products?.map((product) => product?.handle).sort(),
        ).toEqual([...APPLE_SLUGS].sort())

        const apple = (await variantRows(container)).filter((variant) =>
          APPLE_SLUGS.includes(variant.product?.handle as string),
        )
        expect(apple).toHaveLength(25)
        for (const variant of apple) {
          expect(variant.price_set?.prices ?? []).toEqual([])
          expect(variant.manage_inventory).toBe(true)
          expect(variant.allow_backorder).toBe(false)
        }

        const { data: levels } = await query.graph({
          entity: "inventory_item",
          fields: ["sku", "location_levels.stocked_quantity"],
          filters: { sku: apple.map((variant) => variant.sku as string) },
        })
        expect(levels).toHaveLength(25)
        for (const item of levels) {
          expect(
            item.location_levels?.map((level) =>
              Number(level?.stocked_quantity),
            ),
          ).toEqual([0])
        }
      })

      it("rejects an Apple variant in the cart: no price (barrier 2)", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const setup = await seedAll(container)
        const [{ token }] = (
          await query.graph({
            entity: "api_key",
            fields: ["token"],
            filters: { id: setup.publishableApiKeyId },
          })
        ).data
        const headers = { "x-publishable-api-key": token }
        const cart = await api.post(
          "/store/carts",
          { region_id: setup.regionId },
          { headers },
        )
        const variants = await variantRows(container)
        const appleVariant = variants.find((variant) =>
          APPLE_SLUGS.includes(variant.product?.handle as string),
        )

        const response = await api
          .post(
            `/store/carts/${cart.data.cart.id}/line-items`,
            { variant_id: appleVariant?.id, quantity: 1 },
            { headers },
          )
          .catch((error) => error.response)
        expect(response.status).toBe(400)
      })

      it("creates one inventory level per variant at Almacén Lima, at 0", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const setup = await seedAll(container)

        const { data: items } = await query.graph({
          entity: "inventory_item",
          fields: [
            "sku",
            "location_levels.location_id",
            "location_levels.stocked_quantity",
          ],
        })
        expect(items).toHaveLength(56)
        for (const item of items) {
          expect(
            item.location_levels?.map((level) => [
              level?.location_id,
              Number(level?.stocked_quantity),
            ]),
          ).toEqual([[setup.stockLocationId, 0]])
        }
      })

      it("creates 9 spec schemas with 75 definitions and 19 spec sheets, linked", async () => {
        const container = getContainer()
        await seedAll(container)
        const specs = container.resolve<SpecsModuleService>(SPECS_MODULE)

        expect(await specs.listSpecSchemas({}, { take: null })).toHaveLength(9)
        expect(
          await specs.listSpecDefinitions({}, { take: null }),
        ).toHaveLength(75)
        expect(
          await specs.listProductSpecSheets({}, { take: null }),
        ).toHaveLength(19)

        const categories = await graphRows<{
          handle: string
          spec_schema?: { id: string } | null
        }>(container, "product_category", ["handle", "spec_schema.id"])
        expect(categories).toHaveLength(9)
        for (const category of categories) {
          expect(category.spec_schema?.id).toBeDefined()
        }

        const products = await graphRows<{
          handle: string
          product_spec_sheet?: { id: string } | null
        }>(container, "product", ["handle", "product_spec_sheet.id"])
        const charger = products.find(
          (product) => product.handle === "anker-prime-charger-100w-3-puertos",
        )
        const [sheet] = await specs.listResolvedSpecs([
          charger?.product_spec_sheet?.id as string,
        ])
        const maxPower = sheet.specs.find((spec) => spec.key === "maxPower")
        expect(maxPower).toMatchObject({ label: "Potencia máxima", unit: "W" })
        expect(maxPower?.value).toBe(100)
        for (const product of products) {
          expect(product.product_spec_sheet?.id).toBeDefined()
        }
      })

      it("creates 6 rubrics with 30 criteria and 8 expert reviews, linked", async () => {
        const container = getContainer()
        await seedAll(container)
        const editorial =
          container.resolve<EditorialModuleService>(EDITORIAL_MODULE)

        const rubrics = await editorial.listRubrics()
        expect(rubrics).toHaveLength(6)
        expect(rubrics.flatMap((rubric) => rubric.criteria)).toHaveLength(30)

        const categories = await graphRows<{
          handle: string
          review_rubric?: { id: string } | null
        }>(container, "product_category", ["handle", "review_rubric.id"])
        const withRubric = categories
          .filter((category) => category.review_rubric?.id)
          .map((category) => category.handle)
          .sort()
        expect(withRubric).toEqual([
          "almacenamiento",
          "audio",
          "carga-inalambrica",
          "cargadores",
          "hubs-y-docks",
          "power-banks",
        ])

        const products = await graphRows<{
          handle: string
          expert_review?: { id: string } | null
        }>(container, "product", ["handle", "expert_review.id"])
        const reviewed = products.filter((product) => product.expert_review?.id)
        expect(reviewed.map((product) => product.handle).sort()).toEqual(
          PRODUCTS.filter((product) => product.expertReview)
            .map((product) => product.slug)
            .sort(),
        )
        expect(reviewed).toHaveLength(8)

        const charger = reviewed.find(
          (product) => product.handle === "anker-prime-charger-100w-3-puertos",
        )
        const review = await editorial.getReview(
          charger?.expert_review?.id as string,
        )
        expect(review.scores.map((line) => line.criterion)).toEqual([
          "Potencia",
          "Uso con varios equipos",
          "Portabilidad",
          "Relación precio-calidad",
        ])
        expect(review.scores.map((line) => line.score)).toEqual([5, 4, 4, 5])
      })

      it("creates nothing and changes nothing on a second run", async () => {
        const container = getContainer()
        await seedAll(container)
        const before = await snapshot(container)

        const second = await seedCatalog(container)

        expect(
          Object.values(second.created).every((count) => count === 0),
        ).toBe(true)
        expect(await snapshot(container)).toEqual(before)
      })

      it("keeps what the owner changed in the admin: title, stock and a spec", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const setup = await seedAll(container)
        const specs = container.resolve<SpecsModuleService>(SPECS_MODULE)

        const [product] = await graphRows<{
          id: string
          product_spec_sheet?: { id: string; schema_id: string } | null
        }>(
          container,
          "product",
          ["id", "product_spec_sheet.id", "product_spec_sheet.schema_id"],
          { handle: "anker-prime-charger-100w-3-puertos" },
        )
        await updateProductsWorkflow(container).run({
          input: { selector: { id: product.id }, update: { title: "Editado" } },
        })
        const {
          data: [item],
        } = await query.graph({
          entity: "inventory_item",
          fields: ["id"],
          filters: { sku: "ANK-A2688" },
        })
        await updateInventoryLevelsWorkflow(container).run({
          input: {
            updates: [
              {
                inventory_item_id: item.id,
                location_id: setup.stockLocationId,
                stocked_quantity: 7,
              },
            ],
          },
        })
        const sheetId = product.product_spec_sheet?.id as string
        const { definitions } = await specs.getSchema(
          product.product_spec_sheet?.schema_id as string,
        )
        const values = Object.fromEntries(
          (await specs.listResolvedSpecs([sheetId]))[0].specs.map((spec) => [
            spec.key,
            spec.value,
          ]),
        )
        await specs.upsertSheet(
          sheetId,
          product.product_spec_sheet?.schema_id as string,
          { ...values, maxPower: 120 },
        )
        expect(definitions.length).toBeGreaterThan(0)

        await seedCatalog(container)

        const {
          data: [after],
        } = await query.graph({
          entity: "product",
          fields: ["title"],
          filters: { id: product.id },
        })
        expect(after.title).toBe("Editado")
        const {
          data: [level],
        } = await query.graph({
          entity: "inventory_level",
          fields: ["stocked_quantity"],
          filters: { inventory_item_id: item.id },
        })
        expect(Number(level.stocked_quantity)).toBe(7)
        const [resolved] = await specs.listResolvedSpecs([sheetId])
        expect(
          resolved.specs.find((spec) => spec.key === "maxPower")?.value,
        ).toBe(120)
      })

      it("fails without creating anything when the setup layer has not run", async () => {
        const container = getContainer()
        const before = await snapshot(container)

        await expect(seedCatalog(container)).rejects.toThrow(/setup layer/i)

        expect(await snapshot(container)).toEqual(before)
        const link = container.resolve(Modules.PRODUCT)
        expect(await link.listProducts({})).toEqual([])
      })
    })
  },
})
