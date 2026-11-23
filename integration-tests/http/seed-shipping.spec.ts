import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { UBIGEO_SHIPPING_MODULE } from "../../src/modules/ubigeo-shipping"
import { snapshot } from "../../src/scripts/seed/__tests__/support"
import { graphRows } from "../../src/scripts/seed/query"
import { seedSetup } from "../../src/scripts/seed/setup"

jest.setTimeout(180 * 1000)

const DEPARTAMENTO_ISO = [
  "pe-ama",
  "pe-anc",
  "pe-apu",
  "pe-are",
  "pe-aya",
  "pe-caj",
  "pe-cus",
  "pe-huv",
  "pe-huc",
  "pe-ica",
  "pe-jun",
  "pe-lal",
  "pe-lam",
  "pe-lim",
  "pe-lor",
  "pe-mdd",
  "pe-moq",
  "pe-pas",
  "pe-piu",
  "pe-pun",
  "pe-sam",
  "pe-tac",
  "pe-tum",
  "pe-uca",
]

type OptionRow = {
  id: string
  name: string
  price_type: string
  provider_id: string
  type: { code: string } | null
  rules: { attribute: string; operator: string; value: string }[]
  prices: { amount: number | string; currency_code: string }[]
  service_zone: { name: string }
  shipping_profile: { type: string }
  transit_time: { id: string; min_days: number; max_days: number } | null
}

const options = (container: MedusaContainer) =>
  graphRows<OptionRow>(container, "shipping_option", [
    "id",
    "name",
    "price_type",
    "provider_id",
    "type.code",
    "rules.attribute",
    "rules.operator",
    "rules.value",
    "prices.amount",
    "prices.currency_code",
    "service_zone.name",
    "shipping_profile.type",
    "transit_time.id",
    "transit_time.min_days",
    "transit_time.max_days",
  ])

const optionByCode = async (container: MedusaContainer, code: string) => {
  const found = (await options(container)).find(
    (option) => option.type?.code === code,
  )
  if (!found) throw new Error(`No shipping option ${code}`)
  return found
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("seed setup layer: shipping and the publishable key", () => {
      it("creates the default shipping profile and the fulfillment set linked to the stock location", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const setup = await seedSetup(container, { regime: "nrus" })

        const { data: profiles } = await query.graph({
          entity: "shipping_profile",
          fields: ["id", "name", "type"],
          filters: { type: "default" },
        })
        expect(profiles).toEqual([
          expect.objectContaining({
            id: setup.shippingProfileId,
            name: "Default Shipping Profile",
          }),
        ])

        const sets = await graphRows<{
          id: string
          name: string
          type: string
          service_zones: {
            name: string
            geo_zones: {
              type: string
              country_code: string
              province_code: string
            }[]
          }[]
          locations: { id: string }[]
        }>(container, "fulfillment_set", [
          "id",
          "name",
          "type",
          "service_zones.name",
          "service_zones.geo_zones.type",
          "service_zones.geo_zones.country_code",
          "service_zones.geo_zones.province_code",
          "locations.id",
        ])
        expect(sets).toHaveLength(1)
        expect(sets[0]).toMatchObject({ name: "Envíos Perú", type: "shipping" })
        expect(sets[0].locations.map((location) => location.id)).toEqual([
          setup.stockLocationId,
        ])
        expect(sets[0].service_zones.map((zone) => zone.name).sort()).toEqual([
          "Callao",
          "Lima Metropolitana",
          "Resto del Perú",
        ])

        const provinces = (name: string) =>
          sets[0].service_zones
            .find((zone) => zone.name === name)
            ?.geo_zones.map((geoZone) => {
              expect(geoZone).toMatchObject({
                type: "province",
                country_code: "pe",
              })
              return geoZone.province_code
            })
            .sort()
        expect(provinces("Lima Metropolitana")).toEqual(["pe-lma"])
        expect(provinces("Callao")).toEqual(["pe-cal"])
        // The other 24 codes, pe-lim included; never pe-lma or pe-cal.
        expect(provinces("Resto del Perú")).toEqual(
          [...DEPARTAMENTO_ISO].sort(),
        )
        expect(provinces("Resto del Perú")).toHaveLength(24)
      })

      it("creates 3 flat shipping options with their prices, rules and transit times", async () => {
        const container = getContainer()
        await seedSetup(container, { regime: "nrus" })

        const all = await options(container)
        expect(all).toHaveLength(3)
        const expected = [
          ["lima_metro", "Lima Metropolitana", 10, 1, 2],
          ["callao", "Callao", 12, 1, 2],
          ["rest_of_peru", "Resto del Perú", 20, 3, 5],
        ] as const
        for (const [code, name, price, min, max] of expected) {
          const option = await optionByCode(container, code)
          expect(option).toMatchObject({
            name,
            price_type: "flat",
            provider_id: "manual_manual",
            shipping_profile: { type: "default" },
            service_zone: { name },
            transit_time: { min_days: min, max_days: max },
          })
          expect(
            option.prices.map((p) => [p.currency_code, Number(p.amount)]),
          ).toEqual([["pen", price]])
          expect(
            option.rules
              .map((rule) => [rule.attribute, rule.operator, rule.value])
              .sort(),
          ).toEqual([
            ["enabled_in_store", "eq", "true"],
            ["is_return", "eq", "false"],
          ])
        }
      })

      it("creates one publishable API key titled Storefront, linked to the sales channel", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const setup = await seedSetup(container, { regime: "nrus" })

        const { data: keys } = await query.graph({
          entity: "api_key",
          fields: ["id", "title", "type", "token", "sales_channels.id"],
          filters: { type: "publishable" },
        })
        expect(keys).toHaveLength(1)
        expect(keys[0]).toMatchObject({
          id: setup.publishableApiKeyId,
          title: "Storefront",
        })
        expect(keys[0].token).toMatch(/^pk_/)
        expect(keys[0].sales_channels?.map((channel) => channel?.id)).toEqual([
          setup.salesChannelId,
        ])
      })

      it("offers exactly one option per zone to a cart, by the address province", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const setup = await seedSetup(container, { regime: "nrus" })
        const {
          data: [key],
        } = await query.graph({
          entity: "api_key",
          fields: ["token"],
          filters: { id: setup.publishableApiKeyId },
        })
        const headers = { "x-publishable-api-key": key.token }

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
                    prices: [{ amount: 249.9, currency_code: "pen" }],
                  },
                ],
                sales_channels: [{ id: setup.salesChannelId }],
                shipping_profile_id: setup.shippingProfileId,
              },
            ],
          },
        })

        const optionNamesFor = async (province: string) => {
          const created = await api.post(
            "/store/carts",
            {
              region_id: setup.regionId,
              items: [{ variant_id: product.variants[0].id, quantity: 1 }],
              shipping_address: {
                country_code: "pe",
                province,
                city: "Prueba",
                postal_code: "000000",
              },
            },
            { headers },
          )
          const listed = await api.get(
            `/store/shipping-options?cart_id=${created.data.cart.id}`,
            { headers },
          )
          return listed.data.shipping_options.map(
            (option: { name: string; amount: number }) => [
              option.name,
              option.amount,
            ],
          )
        }

        expect(await optionNamesFor("pe-lma")).toEqual([
          ["Lima Metropolitana", 10],
        ])
        expect(await optionNamesFor("pe-cal")).toEqual([["Callao", 12]])
        expect(await optionNamesFor("pe-are")).toEqual([["Resto del Perú", 20]])
        expect(await optionNamesFor("pe-lim")).toEqual([["Resto del Perú", 20]])
      })

      it("creates and changes nothing on a second run", async () => {
        const container = getContainer()
        const first = await seedSetup(container, { regime: "nrus" })
        const before = await snapshot(container)

        const second = await seedSetup(container, { regime: "nrus" })

        expect(second).toEqual(first)
        expect(await snapshot(container)).toEqual(before)
      })

      it("keeps what the owner changed: option name and price", async () => {
        const container = getContainer()
        await seedSetup(container, { regime: "nrus" })
        const lima = await optionByCode(container, "lima_metro")
        await updateShippingOptionsWorkflow(container).run({
          input: [
            {
              id: lima.id,
              name: "Lima Express",
              prices: [{ currency_code: "pen", amount: 15 }],
            },
          ],
        })

        await seedSetup(container, { regime: "nrus" })

        expect(await options(container)).toHaveLength(3)
        const after = await optionByCode(container, "lima_metro")
        expect(after.name).toBe("Lima Express")
        expect(after.prices.map((price) => Number(price.amount))).toEqual([15])
      })

      it("completes a partial seed: missing links of present records come back", async () => {
        const container = getContainer()
        const link = container.resolve(ContainerRegistrationKeys.LINK)
        const setup = await seedSetup(container, { regime: "nrus" })
        const callao = await optionByCode(container, "callao")

        await link.dismiss({
          [Modules.FULFILLMENT]: { shipping_option_id: callao.id },
          [UBIGEO_SHIPPING_MODULE]: {
            transit_time_id: await transitTimeIdOf(container, callao.id),
          },
        })
        await link.dismiss({
          [Modules.API_KEY]: { publishable_key_id: setup.publishableApiKeyId },
          [Modules.SALES_CHANNEL]: { sales_channel_id: setup.salesChannelId },
        })
        await link.dismiss({
          [Modules.STOCK_LOCATION]: {
            stock_location_id: setup.stockLocationId,
          },
          [Modules.FULFILLMENT]: {
            fulfillment_set_id: setup.fulfillmentSetId,
          },
        })

        await seedSetup(container, { regime: "nrus" })

        expect(
          (await optionByCode(container, "callao")).transit_time,
        ).toMatchObject({ min_days: 1, max_days: 2 })
        const [key] = await graphRows<{ sales_channels: { id: string }[] }>(
          container,
          "api_key",
          ["sales_channels.id"],
          { id: setup.publishableApiKeyId },
        )
        expect(key.sales_channels.map((channel) => channel.id)).toEqual([
          setup.salesChannelId,
        ])
        const [set] = await graphRows<{ locations: { id: string }[] }>(
          container,
          "fulfillment_set",
          ["locations.id"],
          { id: setup.fulfillmentSetId },
        )
        expect(set.locations.map((location) => location.id)).toEqual([
          setup.stockLocationId,
        ])
        expect(await options(container)).toHaveLength(3)
      })
    })
  },
})

async function transitTimeIdOf(
  container: MedusaContainer,
  shippingOptionId: string,
): Promise<string> {
  const [option] = await graphRows<{ transit_time: { id: string } }>(
    container,
    "shipping_option",
    ["transit_time.id"],
    { id: shippingOptionId },
  )
  return option.transit_time.id
}
