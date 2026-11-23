import type {
  CreateCustomerAddressDTO,
  MedusaContainer,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  createCustomerAccountWorkflow,
  createCustomerAddressesWorkflow,
  updateInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows"
import { UBIGEO_SHIPPING_MODULE } from "../../modules/ubigeo-shipping"
import type UbigeoShippingModuleService from "../../modules/ubigeo-shipping/service"
import { DEMO_ACCOUNT } from "../seed-data/demo"
import { PRODUCTS } from "../seed-data/products"
import { assertDemoAllowed, demoPassword } from "./layers"
import { graphRows } from "./query"
import { SETUP } from "./setup"

/** Stock of each in-stock variant (docs/seed-plan.md, step 24). */
export const DEMO_STOCK = 10

export type DemoOptions = {
  /** Defaults to `process.env.NODE_ENV`. */
  nodeEnv?: string
  /** Defaults to `process.env`; holds the demo password. */
  env?: Record<string, string | undefined>
}

export type DemoResult = {
  created: { stockLevels: number; customers: number; addresses: number }
  /** Plan steps this build cannot run yet, and why. */
  blocked: string[]
}

type InventoryRow = {
  id: string
  sku: string
  location_levels: { location_id: string; stocked_quantity: number | string }[]
}

/**
 * Step 24: stock 10 on each in-stock variant. Set only while the level's
 * `stocked_quantity` is 0, so stock the owner recorded is never overwritten.
 */
async function seedStock(container: MedusaContainer): Promise<number> {
  const [location] = await graphRows<{ id: string }>(
    container,
    "stock_location",
    ["id"],
    { name: SETUP.stockLocationName },
  )
  const skus = PRODUCTS.flatMap((product) =>
    product.variants
      .filter((variant) => variant.availability === "in_stock")
      .map((variant) => variant.sku),
  )
  const items = await graphRows<InventoryRow>(
    container,
    "inventory_item",
    [
      "id",
      "sku",
      "location_levels.location_id",
      "location_levels.stocked_quantity",
    ],
    { sku: skus },
  )
  const missing = skus.filter((sku) => !items.some((item) => item.sku === sku))
  if (!location || missing.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "The demo layer needs the setup and catalog layers first: run `seed.ts setup catalog`.",
    )
  }

  const updates = items.flatMap((item) => {
    const level = item.location_levels.find(
      (candidate) => candidate.location_id === location.id,
    )
    return level && Number(level.stocked_quantity) === 0
      ? [
          {
            inventory_item_id: item.id,
            location_id: location.id,
            stocked_quantity: DEMO_STOCK,
          },
        ]
      : []
  })
  if (updates.length) {
    await updateInventoryLevelsWorkflow(container).run({ input: { updates } })
  }
  return updates.length
}

/** The auth identity of the demo account: registered once, found by email later. */
async function ensureAuthIdentity(
  container: MedusaContainer,
  password: string,
): Promise<string> {
  const auth = container.resolve(Modules.AUTH)
  const { email } = DEMO_ACCOUNT

  const [existing] = await auth.listProviderIdentities({
    entity_id: email,
    provider: "emailpass",
  })
  if (existing?.auth_identity_id) {
    return existing.auth_identity_id
  }

  const { success, authIdentity, error } = await auth.register("emailpass", {
    body: { email, password },
  } as never)
  if (!success || !authIdentity) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Could not register the demo account: ${error ?? "unknown error"}`,
    )
  }
  return authIdentity.id
}

/** Step 27: the demo customer, keyed by email. */
async function ensureCustomer(
  container: MedusaContainer,
  password: string,
): Promise<{ id: string; created: boolean }> {
  const [existing] = await graphRows<{ id: string }>(
    container,
    "customer",
    ["id"],
    { email: DEMO_ACCOUNT.email },
  )
  if (existing) {
    return { id: existing.id, created: false }
  }

  const authIdentityId = await ensureAuthIdentity(container, password)
  const customer = await createCustomerAccountWorkflow(container).run({
    input: {
      authIdentityId,
      customerData: {
        email: DEMO_ACCOUNT.email,
        first_name: DEMO_ACCOUNT.firstName,
        last_name: DEMO_ACCOUNT.lastName,
        phone: DEMO_ACCOUNT.phone,
      },
    },
  })
  return { id: customer.result.id, created: true }
}

/**
 * Step 28: the demo addresses, keyed by customer and `address_name`. The
 * address `province` is `subdivisionOf(postal_code)` (ubigeo-shipping), so the
 * reference layer must have run.
 */
async function ensureAddresses(
  container: MedusaContainer,
  customerId: string,
): Promise<number> {
  const ubigeo = container.resolve<UbigeoShippingModuleService>(
    UBIGEO_SHIPPING_MODULE,
  )
  const present = await graphRows<{ address_name: string | null }>(
    container,
    "customer_address",
    ["address_name"],
    { customer_id: customerId },
  )
  const names = new Set(present.map((address) => address.address_name))
  const missing = DEMO_ACCOUNT.addresses.filter(
    (address) => !names.has(address.label),
  )

  const addresses: CreateCustomerAddressDTO[] = []
  for (const address of missing) {
    const province = await ubigeo.subdivisionOf(address.distritoCode)
    if (!province) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Ubigeo ${address.distritoCode} is unknown: run the reference layer first.`,
      )
    }
    addresses.push({
      customer_id: customerId,
      address_name: address.label,
      first_name: DEMO_ACCOUNT.firstName,
      last_name: DEMO_ACCOUNT.lastName,
      address_1: address.line,
      ...(address.reference && { address_2: address.reference }),
      city: address.distritoName,
      province,
      postal_code: address.distritoCode,
      country_code: "pe",
      is_default_shipping: address.isDefaultShipping,
    })
  }
  if (addresses.length) {
    await createCustomerAddressesWorkflow(container).run({
      input: { addresses },
    })
  }
  return addresses.length
}

/**
 * Demo layer (docs/seed-plan.md, steps 24 and 27–28). It refuses to run when
 * `NODE_ENV` is `production` and without the demo password variable, before
 * it writes anything.
 *
 * Not built yet, and reported in `blocked`:
 * - steps 25–26 (demo supplier and the 7 offers): the procurement module does
 *   not exist;
 * - step 29 (2 favorites): the customer ↔ product link with `favorited_at` is
 *   not defined in `src/links`.
 */
export async function seedDemo(
  container: MedusaContainer,
  options: DemoOptions = {},
): Promise<DemoResult> {
  assertDemoAllowed(options.nodeEnv ?? process.env.NODE_ENV)
  const password = demoPassword(options.env ?? process.env)

  const stockLevels = await seedStock(container)
  const customer = await ensureCustomer(container, password)
  const addresses = await ensureAddresses(container, customer.id)

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const blocked = [
    "supplier and offers (steps 25-26): the procurement module does not exist",
    "favorites (step 29): the customer-product link is not defined in src/links",
  ]
  logger.warn(`Seed demo layer skipped: ${blocked.join("; ")}.`)

  return {
    created: { stockLevels, customers: customer.created ? 1 : 0, addresses },
    blocked,
  }
}
