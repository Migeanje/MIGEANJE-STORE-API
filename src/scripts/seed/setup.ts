import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createPricePreferencesWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateApiKeysWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  peruDefaultTaxRate,
  REGIME_CONFIG,
  type Regime,
} from "../../config/regime"
import { UBIGEO_SHIPPING_MODULE } from "../../modules/ubigeo-shipping"
import {
  CALLAO_DEPARTAMENTO,
  LIMA_METRO_SUBDIVISION,
  SHIPPING_ZONE_LABELS,
} from "../../modules/ubigeo-shipping/domain/shipping-zone"
import type UbigeoShippingModuleService from "../../modules/ubigeo-shipping/service"
import { SHIPPING_RATES } from "../seed-data/shipping"
import type { SeedShippingZone } from "../seed-data/types"
import { DEPARTAMENTOS } from "../seed-data/ubigeo-departamentos"
import { centimosToMajor } from "./money"
import { graphRows } from "./query"

/**
 * Setup layer of the seed (docs/seed-plan.md, steps 1–5, 7–11 and 19).
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
  shippingProfileName: "Default Shipping Profile",
  shippingProfileType: "default",
  fulfillmentSetName: "Envíos Perú",
  publishableKeyTitle: "Storefront",
  /** Title of the key Medusa creates at startup, which the seed adopts. */
  medusaDefaultKeyTitle: "Default Publishable API Key",
  /** Store metadata key marking the store as configured by this layer. */
  storeMarker: "seed_setup",
} as const

export type SetupResult = {
  storeId: string
  salesChannelId: string
  regionId: string
  stockLocationId: string
  shippingProfileId: string
  fulfillmentSetId: string
  publishableApiKeyId: string
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

/** Step 8: the default shipping profile, keyed by `type`. */
const ensureShippingProfile = async (container: MedusaContainer) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
    filters: { type: SETUP.shippingProfileType },
  })
  if (data[0]) {
    return data[0].id
  }

  const { result } = await createShippingProfilesWorkflow(container).run({
    input: {
      data: [
        {
          name: SETUP.shippingProfileName,
          type: SETUP.shippingProfileType,
        },
      ],
    },
  })
  return result[0].id
}

/**
 * The geo zones of each service zone (docs/seed-plan.md, "Shipping zones and
 * options"): Lima Metropolitana and Callao have one province code each, the
 * rest of Peru the other 24 (the Lima departamento's `pe-lim` included).
 */
const zoneProvinces = (zone: SeedShippingZone): string[] => {
  const callao = DEPARTAMENTOS.find(
    (departamento) => departamento.code === CALLAO_DEPARTAMENTO,
  )?.iso as string
  if (zone === "lima_metro") return [LIMA_METRO_SUBDIVISION]
  if (zone === "callao") return [callao]
  return DEPARTAMENTOS.map(({ iso }) => iso as string).filter(
    (iso) => iso !== callao,
  )
}

const geoZones = (zone: SeedShippingZone) =>
  zoneProvinces(zone).map((province) => ({
    type: "province" as const,
    country_code: SETUP.countryCode,
    province_code: province,
  }))

/**
 * Step 9: the fulfillment set with its service zones, linked to the stock
 * location. A present set keeps its zones; a missing zone is added.
 */
const ensureFulfillmentSet = async (
  container: MedusaContainer,
  stockLocationId: string,
) => {
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillment = container.resolve(Modules.FULFILLMENT)

  const findSet = async () =>
    (
      await graphRows<{
        id: string
        service_zones: { name: string }[]
        locations: { id: string }[]
      }>(
        container,
        "fulfillment_set",
        ["id", "service_zones.name", "locations.id"],
        { name: SETUP.fulfillmentSetName },
      )
    )[0]

  let set = await findSet()
  if (!set) {
    await fulfillment.createFulfillmentSets({
      name: SETUP.fulfillmentSetName,
      type: "shipping",
      service_zones: SHIPPING_RATES.map(({ zone }) => ({
        name: SHIPPING_ZONE_LABELS[zone],
        geo_zones: geoZones(zone),
      })),
    })
    set = await findSet()
  } else {
    const present = new Set(set.service_zones.map((zone) => zone?.name))
    const missing = SHIPPING_RATES.filter(
      ({ zone }) => !present.has(SHIPPING_ZONE_LABELS[zone]),
    )
    if (missing.length) {
      await fulfillment.createServiceZones(
        missing.map(({ zone }) => ({
          name: SHIPPING_ZONE_LABELS[zone],
          fulfillment_set_id: set.id,
          geo_zones: geoZones(zone),
        })),
      )
    }
  }

  const hasLocation = set.locations?.some(
    (location) => location?.id === stockLocationId,
  )
  if (!hasLocation) {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
      [Modules.FULFILLMENT]: { fulfillment_set_id: set.id },
    })
  }
  return set.id
}

/** The id of a transit time of `zone` that no shipping option uses, if any. */
const findFreeTransitTime = async (
  container: MedusaContainer,
  zone: SeedShippingZone,
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "transit_time",
    fields: ["id", "shipping_option.id"],
    filters: { zone },
  })
  return data.find((row) => !row.shipping_option)?.id
}

/**
 * Steps 10 and 19: one flat shipping option per zone, keyed by `type.code`,
 * and its transit time. A present option keeps its name and price; a missing
 * transit time link is added.
 */
const ensureShippingOptions = async (
  container: MedusaContainer,
  ids: { shippingProfileId: string; fulfillmentSetId: string },
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const ubigeo = container.resolve<UbigeoShippingModuleService>(
    UBIGEO_SHIPPING_MODULE,
  )

  const {
    data: [set],
  } = await query.graph({
    entity: "fulfillment_set",
    fields: ["service_zones.id", "service_zones.name"],
    filters: { id: ids.fulfillmentSetId },
  })

  const findOptions = () =>
    graphRows<{
      id: string
      type: { code: string } | null
      transit_time: { id: string } | null
    }>(container, "shipping_option", ["id", "type.code", "transit_time.id"])

  const present = await findOptions()
  const missing = SHIPPING_RATES.filter(
    ({ zone }) => !present.some((option) => option.type?.code === zone),
  )
  if (missing.length) {
    await createShippingOptionsWorkflow(container).run({
      input: missing.map(({ zone, costCentimos }) => {
        const label = SHIPPING_ZONE_LABELS[zone]
        const serviceZone = set.service_zones.find((z) => z?.name === label)
        return {
          name: label,
          price_type: "flat" as const,
          provider_id: SETUP.fulfillmentProviderId,
          service_zone_id: serviceZone?.id as string,
          shipping_profile_id: ids.shippingProfileId,
          type: {
            label,
            description: `Envío a ${label}`,
            code: zone,
          },
          prices: [
            {
              currency_code: SETUP.currencyCode,
              amount: centimosToMajor(costCentimos),
            },
          ],
          rules: [
            {
              attribute: "enabled_in_store",
              value: "true",
              operator: "eq" as const,
            },
            { attribute: "is_return", value: "false", operator: "eq" as const },
          ],
        }
      }),
    })
  }

  for (const option of await findOptions()) {
    const rate = SHIPPING_RATES.find(({ zone }) => zone === option.type?.code)
    if (!rate || option.transit_time) continue

    const transitTimeId =
      (await findFreeTransitTime(container, rate.zone)) ??
      (
        await ubigeo.createTransitTimes({
          zone: rate.zone,
          min_days: rate.transitDays.min,
          max_days: rate.transitDays.max,
        })
      ).id
    await link.create({
      [Modules.FULFILLMENT]: { shipping_option_id: option.id },
      [UBIGEO_SHIPPING_MODULE]: { transit_time_id: transitTimeId },
    })
  }
}

/**
 * Step 11: the publishable API key, linked to the sales channel. Medusa
 * creates a "Default Publishable API Key" at startup (createDefaultsWorkflow),
 * so the store would end up with two; the seed adopts that one by giving it
 * the title "Storefront", and creates a key only when there is none. A key
 * already titled "Storefront" is kept. The key is public: it is logged once,
 * when the seed creates it, for the storefront environment.
 */
const ensurePublishableKey = async (
  container: MedusaContainer,
  salesChannelId: string,
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const findKey = async (title: string) =>
    (
      await query.graph({
        entity: "api_key",
        fields: ["id", "token", "sales_channels.id"],
        filters: { type: "publishable", title },
      })
    ).data[0]

  let key = await findKey(SETUP.publishableKeyTitle)
  if (!key) {
    const medusaKey = await findKey(SETUP.medusaDefaultKeyTitle)
    if (medusaKey) {
      await updateApiKeysWorkflow(container).run({
        input: {
          selector: { id: medusaKey.id },
          update: { title: SETUP.publishableKeyTitle },
        },
      })
    } else {
      await createApiKeysWorkflow(container).run({
        input: {
          api_keys: [
            {
              title: SETUP.publishableKeyTitle,
              type: "publishable",
              created_by: "",
            },
          ],
        },
      })
    }
    key = await findKey(SETUP.publishableKeyTitle)
    logger.info(
      `Publishable API key "${SETUP.publishableKeyTitle}" (public; set it in the storefront environment): ${key.token}`,
    )
  }

  const hasChannel = key.sales_channels?.some(
    (channel) => channel?.id === salesChannelId,
  )
  if (!hasChannel) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: key.id, add: [salesChannelId] },
    })
  }
  return key.id
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
  const shippingProfileId = await ensureShippingProfile(container)
  const fulfillmentSetId = await ensureFulfillmentSet(
    container,
    stockLocationId,
  )
  await ensureShippingOptions(container, {
    shippingProfileId,
    fulfillmentSetId,
  })
  const publishableApiKeyId = await ensurePublishableKey(
    container,
    salesChannelId,
  )

  return {
    storeId,
    salesChannelId,
    regionId,
    stockLocationId,
    shippingProfileId,
    fulfillmentSetId,
    publishableApiKeyId,
  }
}
