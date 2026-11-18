import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  createPricePreferencesWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  peruDefaultTaxRate,
  REGIME_CONFIG,
  type Regime,
} from "../../config/regime"

/**
 * Setup layer of the seed (docs/seed-plan.md, steps 1–5 and 7).
 *
 * Every record is looked up by its natural key first. A missing record is
 * created; a present one is kept, so a re-run creates nothing and never
 * overwrites what the owner changed in the admin. Missing links of a present
 * record are added, so a re-run completes a partial seed.
 */
export const SETUP = {
  salesChannelName: "Default Sales Channel",
  storeName: "Migeanje Store",
  currencyCode: "pen",
  regionName: "Perú",
  countryCode: "pe",
  taxProviderId: "tp_system",
  stockLocationName: "Almacén Lima",
  fulfillmentProviderId: "manual_manual",
  /** Store metadata key marking the store as configured by this layer. */
  storeMarker: "seed_setup",
} as const

export type SetupResult = {
  storeId: string
  salesChannelId: string
  regionId: string
  stockLocationId: string
}

type SetupOptions = { regime?: Regime }

const ensureSalesChannel = async (container: MedusaContainer) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
    filters: { name: SETUP.salesChannelName },
  })
  if (data[0]) {
    return data[0].id
  }

  const { result } = await createSalesChannelsWorkflow(container).run({
    input: { salesChannelsData: [{ name: SETUP.salesChannelName }] },
  })
  return result[0].id
}

/** Step 2: Medusa creates the one store at startup; this layer configures it once. */
const ensureStore = async (
  container: MedusaContainer,
  salesChannelId: string,
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "store",
    fields: ["id", "metadata"],
  })
  const store = data[0]
  if (!store) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No store found: Medusa creates one at startup.",
    )
  }
  if (store.metadata?.[SETUP.storeMarker]) {
    return store.id
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: SETUP.storeName,
        // Also upserts the `pen` price preference as tax-inclusive.
        supported_currencies: [
          {
            currency_code: SETUP.currencyCode,
            is_default: true,
            is_tax_inclusive: true,
          },
        ],
        default_sales_channel_id: salesChannelId,
        metadata: { ...store.metadata, [SETUP.storeMarker]: true },
      },
    },
  })
  return store.id
}

/** Step 3. Payment providers come with the Culqi provider in F3b. */
const ensureRegion = async (container: MedusaContainer) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "region",
    fields: ["id", "countries.iso_2"],
  })
  const existing = data.find((region) =>
    region.countries?.some((country) => country?.iso_2 === SETUP.countryCode),
  )
  if (existing) {
    return existing.id
  }

  const { result } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: SETUP.regionName,
          currency_code: SETUP.currencyCode,
          countries: [SETUP.countryCode],
        },
      ],
    },
  })
  return result[0].id
}

/** Step 4: created only when missing; the regime switch follows ADR 0008, decision 5. */
const ensureTaxRegion = async (container: MedusaContainer, regime: Regime) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "tax_region",
    fields: ["id"],
    filters: { country_code: SETUP.countryCode },
  })
  if (data.length) {
    return
  }

  const rate = peruDefaultTaxRate(regime)
  await createTaxRegionsWorkflow(container).run({
    input: [
      {
        country_code: SETUP.countryCode,
        provider_id: SETUP.taxProviderId,
        ...(rate ? { default_tax_rate: rate } : {}),
      },
    ],
  })
}

/** Step 5: prices in `pen` include the tax (ADR 0008, decision 2). */
const ensurePricePreference = async (container: MedusaContainer) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "price_preference",
    fields: ["id"],
    filters: { attribute: "currency_code", value: SETUP.currencyCode },
  })
  if (data.length) {
    return
  }

  await createPricePreferencesWorkflow(container).run({
    input: [
      {
        attribute: "currency_code",
        value: SETUP.currencyCode,
        is_tax_inclusive: true,
      },
    ],
  })
}

/** Step 7: the stock location, its links, and the store's default location. */
const ensureStockLocation = async (
  container: MedusaContainer,
  ids: { storeId: string; salesChannelId: string },
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  const findLocation = async () =>
    (
      await query.graph({
        entity: "stock_location",
        fields: ["id", "sales_channels.id", "fulfillment_providers.id"],
        filters: { name: SETUP.stockLocationName },
      })
    ).data[0]

  let location = await findLocation()
  if (!location) {
    await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: SETUP.stockLocationName,
            address: { city: "Lima", country_code: "PE", address_1: "" },
          },
        ],
      },
    })
    location = await findLocation()
  }

  const hasChannel = location.sales_channels?.some(
    (channel) => channel?.id === ids.salesChannelId,
  )
  if (!hasChannel) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: location.id, add: [ids.salesChannelId] },
    })
  }

  const hasProvider = location.fulfillment_providers?.some(
    (provider) => provider?.id === SETUP.fulfillmentProviderId,
  )
  if (!hasProvider) {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: SETUP.fulfillmentProviderId,
      },
    })
  }

  const {
    data: [store],
  } = await query.graph({
    entity: "store",
    fields: ["default_location_id"],
    filters: { id: ids.storeId },
  })
  if (!store.default_location_id) {
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: ids.storeId },
        update: { default_location_id: location.id },
      },
    })
  }

  return location.id
}

export async function seedSetup(
  container: MedusaContainer,
  options: SetupOptions = {},
): Promise<SetupResult> {
  const regime = options.regime ?? REGIME_CONFIG.regime

  const salesChannelId = await ensureSalesChannel(container)
  const storeId = await ensureStore(container, salesChannelId)
  const regionId = await ensureRegion(container)
  await ensureTaxRegion(container, regime)
  await ensurePricePreference(container)
  const stockLocationId = await ensureStockLocation(container, {
    storeId,
    salesChannelId,
  })

  return { storeId, salesChannelId, regionId, stockLocationId }
}
