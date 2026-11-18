import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createProductsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedSetup } from "../../src/scripts/seed/setup"

jest.setTimeout(120 * 1000)

const SHELF_PRICE = 249.9

const counts = async (container: MedusaContainer) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const count = async (entity: string) =>
    (await query.graph({ entity, fields: ["id"] })).data.length

  return {
    stores: await count("store"),
    salesChannels: await count("sales_channel"),
    regions: await count("region"),
    taxRegions: await count("tax_region"),
    taxRates: await count("tax_rate"),
    pricePreferences: await count("price_preference"),
    stockLocations: await count("stock_location"),
  }
}

/** A tax-inclusive product in the store's sales channel, then a cart for it. */
const cartForOneItem = async (
  container: MedusaContainer,
  // biome-ignore lint/suspicious/noExplicitAny: axios instance from the test runner
  api: any,
  setup: { regionId: string; salesChannelId: string },
) => {
  const {
    result: [apiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [{ title: "Test", type: "publishable", created_by: "" }],
    },
  })
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: apiKey.id, add: [setup.salesChannelId] },
  })

  const {
    result: [product],
  } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Cargador de prueba",
          status: "published",
          options: [{ title: "Modelo", values: ["Único"] }],
          variants: [
            {
              title: "Único",
              options: { Modelo: "Único" },
              manage_inventory: false,
              prices: [{ amount: SHELF_PRICE, currency_code: "pen" }],
            },
          ],
          sales_channels: [{ id: setup.salesChannelId }],
        },
      ],
    },
  })

  const response = await api.post(
    "/store/carts",
    {
      region_id: setup.regionId,
      items: [{ variant_id: product.variants[0].id, quantity: 1 }],
      shipping_address: { country_code: "pe" },
    },
    { headers: { "x-publishable-api-key": apiKey.token } },
  )

  return response.data.cart
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("seed setup layer", () => {
      it("sets up the Peru region, the PEN store, tax-inclusive prices, the sales channel and the stock location", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)

        const setup = await seedSetup(container, { regime: "nrus" })

        const {
          data: [store],
        } = await query.graph({
          entity: "store",
          fields: [
            "name",
            "default_sales_channel_id",
            "default_location_id",
            "supported_currencies.currency_code",
            "supported_currencies.is_default",
          ],
        })
        expect(store.name).toBe("Migeanje Store")
        expect(store.supported_currencies).toEqual([
          expect.objectContaining({ currency_code: "pen", is_default: true }),
        ])
        expect(store.default_sales_channel_id).toBe(setup.salesChannelId)
        expect(store.default_location_id).toBe(setup.stockLocationId)

        const { data: salesChannels } = await query.graph({
          entity: "sales_channel",
          fields: ["id", "name"],
          filters: { id: setup.salesChannelId },
        })
        expect(salesChannels[0].name).toBe("Default Sales Channel")

        const { data: regions } = await query.graph({
          entity: "region",
          fields: ["id", "name", "currency_code", "countries.iso_2"],
        })
        expect(regions).toHaveLength(1)
        expect(regions[0]).toMatchObject({
          id: setup.regionId,
          name: "Perú",
          currency_code: "pen",
        })
        expect(regions[0].countries.map((country) => country?.iso_2)).toEqual([
          "pe",
        ])

        const { data: taxRegions } = await query.graph({
          entity: "tax_region",
          fields: ["country_code", "provider_id", "tax_rates.id"],
        })
        expect(taxRegions).toHaveLength(1)
        expect(taxRegions[0]).toMatchObject({
          country_code: "pe",
          provider_id: "tp_system",
        })
        expect(taxRegions[0].tax_rates).toEqual([])

        const { data: preferences } = await query.graph({
          entity: "price_preference",
          fields: ["attribute", "value", "is_tax_inclusive"],
          filters: { attribute: "currency_code", value: "pen" },
        })
        expect(preferences).toEqual([
          expect.objectContaining({ is_tax_inclusive: true }),
        ])

        const {
          data: [location],
        } = await query.graph({
          entity: "stock_location",
          fields: [
            "id",
            "name",
            "address.city",
            "address.country_code",
            "sales_channels.id",
            "fulfillment_providers.id",
          ],
          filters: { id: setup.stockLocationId },
        })
        expect(location.name).toBe("Almacén Lima")
        expect(location.address).toMatchObject({
          city: "Lima",
          country_code: "PE",
        })
        expect(
          location.sales_channels?.map((channel) => channel?.id),
        ).toContain(setup.salesChannelId)
        expect(
          location.fulfillment_providers?.map((provider) => provider?.id),
        ).toContain("manual_manual")
      })

      it("creates nothing on a second run", async () => {
        const container = getContainer()

        const first = await seedSetup(container, { regime: "nrus" })
        const before = await counts(container)
        const second = await seedSetup(container, { regime: "nrus" })

        expect(await counts(container)).toEqual(before)
        expect(second).toEqual(first)
      })

      it("keeps what the owner changed in the admin", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)

        const setup = await seedSetup(container, { regime: "nrus" })
        await updateStoresWorkflow(container).run({
          input: {
            selector: { id: setup.storeId },
            update: { name: "Migeanje Store Perú" },
          },
        })

        await seedSetup(container, { regime: "nrus" })

        const {
          data: [store],
        } = await query.graph({ entity: "store", fields: ["name"] })
        expect(store.name).toBe("Migeanje Store Perú")
      })

      it("gives the Peru tax region an 18% IGV default rate under regime B", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)

        await seedSetup(container, { regime: "b" })

        const { data: taxRegions } = await query.graph({
          entity: "tax_region",
          fields: [
            "country_code",
            "tax_rates.name",
            "tax_rates.code",
            "tax_rates.rate",
            "tax_rates.is_default",
          ],
        })
        expect(taxRegions[0].tax_rates).toEqual([
          expect.objectContaining({
            name: "IGV",
            code: "igv",
            rate: 18,
            is_default: true,
          }),
        ])
      })

      it("charges no tax under Nuevo RUS: the cart total equals the tax-inclusive price", async () => {
        const container = getContainer()
        const setup = await seedSetup(container, { regime: "nrus" })

        const cart = await cartForOneItem(container, api, setup)

        expect(cart.items[0].is_tax_inclusive).toBe(true)
        expect(cart.items[0].tax_lines).toEqual([])
        expect(cart.tax_total).toBe(0)
        expect(cart.total).toBe(SHELF_PRICE)
      })

      it("keeps the shelf price under regime B and extracts the 18% IGV from it", async () => {
        const container = getContainer()
        const setup = await seedSetup(container, { regime: "b" })

        const cart = await cartForOneItem(container, api, setup)

        expect(cart.items[0].is_tax_inclusive).toBe(true)
        expect(cart.total).toBe(SHELF_PRICE)
        // 249.90 * 18 / 118 = 38.1203...
        expect(cart.tax_total).toBeCloseTo(38.12, 2)
      })
    })
  },
})
