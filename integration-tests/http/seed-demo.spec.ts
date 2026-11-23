import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { snapshot } from "../../src/scripts/seed/__tests__/support"
import { seedCatalog } from "../../src/scripts/seed/catalog"
import { seedDemo } from "../../src/scripts/seed/demo"
import { graphRows } from "../../src/scripts/seed/query"
import { seedReference } from "../../src/scripts/seed/reference"
import { seedSetup } from "../../src/scripts/seed/setup"
import { PRODUCTS } from "../../src/scripts/seed-data/products"

jest.setTimeout(300 * 1000)

const PASSWORD = "demo-password-for-tests"
const env = { SEED_DEMO_PASSWORD: PASSWORD }
const development = { nodeEnv: "development", env }

const IN_STOCK = PRODUCTS.flatMap((product) =>
  product.variants.filter((v) => v.availability === "in_stock"),
).map((variant) => variant.sku)

const stockBySku = async (container: MedusaContainer) => {
  const items = await graphRows<{
    sku: string
    location_levels: { stocked_quantity: number | string }[]
  }>(container, "inventory_item", ["sku", "location_levels.stocked_quantity"])
  return new Map(
    items.map((item) => [
      item.sku,
      item.location_levels.map((level) => Number(level.stocked_quantity)),
    ]),
  )
}

const seedBase = async (container: MedusaContainer) => {
  await seedReference(container)
  await seedSetup(container, { regime: "nrus" })
  await seedCatalog(container)
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("seed demo layer", () => {
      it("refuses to run when NODE_ENV is production, and writes nothing", async () => {
        const container = getContainer()
        await seedBase(container)
        const before = await snapshot(container)

        await expect(
          seedDemo(container, { nodeEnv: "production", env }),
        ).rejects.toThrow(/production/)

        expect(await snapshot(container)).toEqual(before)
      })

      it("refuses to run without SEED_DEMO_PASSWORD, and writes nothing", async () => {
        const container = getContainer()
        await seedBase(container)
        const before = await snapshot(container)

        await expect(
          seedDemo(container, { nodeEnv: "development", env: {} }),
        ).rejects.toThrow(/SEED_DEMO_PASSWORD/)

        expect(await snapshot(container)).toEqual(before)
      })

      it("needs the catalog first and writes nothing without it", async () => {
        const container = getContainer()
        await seedReference(container)
        await seedSetup(container, { regime: "nrus" })
        const before = await snapshot(container)

        await expect(seedDemo(container, development)).rejects.toThrow(
          /catalog layers first/,
        )

        expect(await snapshot(container)).toEqual(before)
      })

      it("stocks the 24 in-stock variants at 10 and leaves the other 32 at 0", async () => {
        const container = getContainer()
        await seedBase(container)

        const result = await seedDemo(container, development)

        expect(result.created.stockLevels).toBe(24)
        const stock = await stockBySku(container)
        expect(stock.size).toBe(56)
        for (const [sku, levels] of stock) {
          expect(levels).toEqual([IN_STOCK.includes(sku) ? 10 : 0])
        }
        expect(IN_STOCK).toHaveLength(24)
      })

      it("creates the demo customer who can sign in with the password from the environment", async () => {
        const container = getContainer()
        await seedBase(container)
        await seedDemo(container, development)

        const [customer] = await graphRows<{
          email: string
          first_name: string
          last_name: string
          phone: string
          has_account: boolean
        }>(container, "customer", [
          "email",
          "first_name",
          "last_name",
          "phone",
          "has_account",
        ])
        expect(customer).toMatchObject({
          email: "demo@migeanje.pe",
          first_name: "Lucía",
          last_name: "Demo",
          phone: "900000000",
          has_account: true,
        })

        const login = await api.post("/auth/customer/emailpass", {
          email: "demo@migeanje.pe",
          password: PASSWORD,
        })
        expect(login.status).toBe(200)
        expect(login.data.token).toEqual(expect.any(String))

        const wrong = await api
          .post("/auth/customer/emailpass", {
            email: "demo@migeanje.pe",
            password: "not-the-password",
          })
          .catch((error) => error.response)
        expect(wrong.status).toBe(401)
      })

      it("creates the 2 addresses with the ubigeo as postal code and the subdivision as province", async () => {
        const container = getContainer()
        await seedBase(container)
        await seedDemo(container, development)

        const addresses = await graphRows<{
          address_name: string
          address_1: string
          address_2: string | null
          city: string
          province: string
          postal_code: string
          country_code: string
          first_name: string
          last_name: string
          is_default_shipping: boolean
        }>(container, "customer_address", [
          "address_name",
          "address_1",
          "address_2",
          "city",
          "province",
          "postal_code",
          "country_code",
          "first_name",
          "last_name",
          "is_default_shipping",
        ])
        const byName = Object.fromEntries(
          addresses.map((address) => [address.address_name, address]),
        )
        expect(Object.keys(byName).sort()).toEqual(["Casa", "Oficina"])
        expect(byName.Casa).toMatchObject({
          address_1: "Av. José Pardo 500, dpto. 302",
          address_2: "Cerca al óvalo Gutiérrez",
          city: "Miraflores",
          province: "pe-lma",
          postal_code: "150122",
          country_code: "pe",
          first_name: "Lucía",
          last_name: "Demo",
          is_default_shipping: true,
        })
        expect(byName.Oficina).toMatchObject({
          address_1: "Calle Mercaderes 210, oficina 4",
          city: "Arequipa",
          province: "pe-are",
          postal_code: "040101",
          is_default_shipping: false,
        })
        expect(byName.Oficina.address_2 || null).toBeNull()
      })

      it("reports what it cannot build: supplier offers and favorites", async () => {
        const container = getContainer()
        await seedBase(container)

        const result = await seedDemo(container, development)

        expect(result.blocked).toEqual([
          expect.stringContaining("procurement"),
          expect.stringContaining("customer-product link"),
        ])
      })

      it("creates and changes nothing on a second run", async () => {
        const container = getContainer()
        await seedBase(container)
        await seedDemo(container, development)
        const before = await snapshot(container)

        const second = await seedDemo(container, development)

        expect(second.created).toEqual({
          stockLevels: 0,
          customers: 0,
          addresses: 0,
        })
        expect(await snapshot(container)).toEqual(before)
      })

      it("keeps what the owner changed: stock above 0 and the customer's name", async () => {
        const container = getContainer()
        await seedBase(container)
        await seedDemo(container, development)
        const customers = container.resolve(Modules.CUSTOMER)
        const [customer] = await customers.listCustomers({
          email: "demo@migeanje.pe",
        })
        await customers.updateCustomers(customer.id, { first_name: "Otra" })

        const items = await graphRows<{ id: string; sku: string }>(
          container,
          "inventory_item",
          ["id", "sku"],
          { sku: IN_STOCK[0] },
        )
        const inventory = container.resolve(Modules.INVENTORY)
        const [level] = await inventory.listInventoryLevels({
          inventory_item_id: items[0].id,
        })
        await inventory.updateInventoryLevels([
          {
            id: level.id,
            inventory_item_id: items[0].id,
            location_id: level.location_id,
            stocked_quantity: 3,
          },
        ])

        const second = await seedDemo(container, development)

        expect(second.created.stockLevels).toBe(0)
        expect((await stockBySku(container)).get(IN_STOCK[0])).toEqual([3])
        expect((await customers.retrieveCustomer(customer.id)).first_name).toBe(
          "Otra",
        )
      })
    })
  },
})
