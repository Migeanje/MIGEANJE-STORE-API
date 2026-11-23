import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { REGIME_CONFIG, type Regime } from "../../config/regime"
import { EDITORIAL_MODULE } from "../../modules/editorial"
import type EditorialModuleService from "../../modules/editorial/service"
import { SPECS_MODULE } from "../../modules/specs"
import type SpecsModuleService from "../../modules/specs/service"
import { UBIGEO_SHIPPING_MODULE } from "../../modules/ubigeo-shipping"
import type UbigeoShippingModuleService from "../../modules/ubigeo-shipping/service"
import { BRANDS } from "../seed-data/brands"
import { CATEGORIES } from "../seed-data/categories"
import { DEMO_ACCOUNT } from "../seed-data/demo"
import { HOLIDAYS } from "../seed-data/holidays"
import { PRODUCTS } from "../seed-data/products"
import { REFUND_REASONS } from "../seed-data/refund-reasons"
import { RUBRICS } from "../seed-data/rubrics"
import { SHIPPING_RATES } from "../seed-data/shipping"
import { DEMO_STOCK } from "./demo"
import type { Layer } from "./layers"
import { centimosToMajor } from "./money"
import { graphRows } from "./query"
import { SETUP } from "./setup"
import { loadUbigeoTree } from "./ubigeo"

/**
 * Post-seed verification (docs/seed-plan.md, "Post-seed verification" and
 * "Seed check: Apple line"). Read-only: it never repairs.
 */
export type CheckResult = {
  name: string
  status: "pass" | "fail" | "skipped"
  detail: string
}

const pass = (name: string, detail = ""): CheckResult => ({
  name,
  status: "pass",
  detail,
})
const fail = (name: string, detail: string): CheckResult => ({
  name,
  status: "fail",
  detail,
})
const skipped = (name: string, detail: string): CheckResult => ({
  name,
  status: "skipped",
  detail,
})

const same = (name: string, actual: unknown, expected: unknown): CheckResult =>
  JSON.stringify(actual) === JSON.stringify(expected)
    ? pass(name, `${JSON.stringify(actual)}`)
    : fail(
        name,
        `expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`,
      )

export const failures = (results: CheckResult[]) =>
  results.filter((result) => result.status === "fail")

/** A readable report, one line per check. */
export const report = (results: CheckResult[]) =>
  results
    .map(
      ({ status, name, detail }) =>
        `${status.toUpperCase().padEnd(7)} ${name}${detail ? ` — ${detail}` : ""}`,
    )
    .join("\n")

const APPLE_SLUGS = PRODUCTS.filter((product) => product.brand === "apple").map(
  (product) => product.slug,
)

type VariantRow = {
  id: string
  sku: string
  manage_inventory: boolean
  allow_backorder: boolean
  product: { handle: string }
  price_set: {
    prices: { amount: number | string; currency_code: string }[]
  } | null
}

const variantRows = (container: MedusaContainer) =>
  graphRows<VariantRow>(container, "product_variant", [
    "id",
    "sku",
    "manage_inventory",
    "allow_backorder",
    "product.handle",
    "price_set.prices.amount",
    "price_set.prices.currency_code",
  ])

const priceCount = (variant: VariantRow) =>
  variant.price_set?.prices.length ?? 0

async function referenceChecks(container: MedusaContainer) {
  const results: CheckResult[] = []
  const ubigeo = container.resolve<UbigeoShippingModuleService>(
    UBIGEO_SHIPPING_MODULE,
  )
  const tree = loadUbigeoTree()
  const departamentos = await ubigeo.listUbigeoDepartamentos({}, { take: null })
  results.push(
    same("Ubigeo departamentos", departamentos.length, tree.length),
    same(
      "Ubigeo departamentos with iso_3166_2",
      departamentos.filter((row) => /^pe-[a-z]{3}$/.test(row.iso_3166_2))
        .length,
      tree.length,
    ),
    same(
      "Ubigeo provincias",
      (await ubigeo.listUbigeoProvincias({}, { take: null })).length,
      tree.reduce((total, d) => total + d.provincias.length, 0),
    ),
    same(
      "Ubigeo distritos",
      (await ubigeo.listUbigeoDistritos({}, { take: null })).length,
      tree.reduce(
        (total, d) =>
          total + d.provincias.reduce((sum, p) => sum + p.distritos.length, 0),
        0,
      ),
    ),
  )

  const holidays = new Map(
    (await ubigeo.listHolidays({}, { take: null })).map((row) => [
      row.date,
      row.name,
    ]),
  )
  const wrong = HOLIDAYS.filter(({ date, name }) => holidays.get(date) !== name)
  results.push(
    wrong.length === 0
      ? pass("Holidays", `${HOLIDAYS.length} as the pinned list`)
      : fail(
          "Holidays",
          `missing or renamed: ${wrong.map((h) => h.date).join(", ")}`,
        ),
  )

  const payment = container.resolve(Modules.PAYMENT)
  const reasons = (await payment.listRefundReasons(
    {},
    { take: null },
  )) as unknown as { code: string; label: string }[]
  const present = REFUND_REASONS.filter((reason) =>
    reasons.some(
      (row) => row.code === reason.code && row.label === reason.label,
    ),
  )
  results.push(same("Refund reasons", present.length, REFUND_REASONS.length))
  return results
}

async function setupChecks(container: MedusaContainer, regime: Regime) {
  const results: CheckResult[] = []

  const channels = await graphRows<{ id: string }>(container, "sales_channel", [
    "id",
  ])
  results.push(same("Sales channels", channels.length, 1))
  const channelId = channels[0]?.id

  const regions = await graphRows<{
    currency_code: string
    countries: { iso_2: string }[]
    payment_providers: { id: string }[]
  }>(container, "region", [
    "currency_code",
    "countries.iso_2",
    "payment_providers.id",
  ])
  results.push(
    same(
      "Regions",
      regions.map((region) => [
        region.currency_code,
        region.countries.map((country) => country.iso_2),
      ]),
      [["pen", ["pe"]]],
    ),
    skipped(
      "Region payment provider pp_culqi_culqi",
      "the Culqi provider arrives in F3b",
    ),
  )

  const taxRegions = await graphRows<{
    country_code: string
    tax_rates: { code: string; rate: number; is_default: boolean }[]
  }>(container, "tax_region", [
    "country_code",
    "tax_rates.code",
    "tax_rates.rate",
    "tax_rates.is_default",
  ])
  results.push(
    same(
      "Tax regions",
      taxRegions.map((region) => [
        region.country_code,
        region.tax_rates.map((rate) => [rate.code, Number(rate.rate)]),
      ]),
      [["pe", regime === "b" ? [["igv", 18]] : []]],
    ),
  )

  const preferences = await graphRows<{ is_tax_inclusive: boolean }>(
    container,
    "price_preference",
    ["is_tax_inclusive"],
    { attribute: "currency_code", value: SETUP.currencyCode },
  )
  results.push(
    same(
      "Price preferences (pen, tax-inclusive)",
      preferences.map((row) => row.is_tax_inclusive),
      [true],
    ),
  )

  const locations = await graphRows<{ sales_channels: { id: string }[] }>(
    container,
    "stock_location",
    ["sales_channels.id"],
  )
  results.push(
    same(
      "Stock locations linked to the sales channel",
      locations.map((location) =>
        location.sales_channels.map((channel) => channel.id),
      ),
      [[channelId]],
    ),
  )

  const zones = await graphRows<{ id: string }>(container, "service_zone", [
    "id",
  ])
  results.push(same("Service zones", zones.length, 3))

  const options = await graphRows<{
    type: { code: string }
    prices: { amount: number | string; currency_code: string }[]
    transit_time: { min_days: number; max_days: number } | null
  }>(container, "shipping_option", [
    "type.code",
    "prices.amount",
    "prices.currency_code",
    "transit_time.min_days",
    "transit_time.max_days",
  ])
  results.push(
    same(
      "Shipping options (price, transit time)",
      options
        .map((option) => [
          option.type.code,
          option.prices.map((price) => [
            price.currency_code,
            Number(price.amount),
          ]),
          option.transit_time && [
            option.transit_time.min_days,
            option.transit_time.max_days,
          ],
        ])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      SHIPPING_RATES.map((rate) => [
        rate.zone,
        [[SETUP.currencyCode, centimosToMajor(rate.costCentimos)]],
        [rate.transitDays.min, rate.transitDays.max],
      ]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ),
  )

  const keys = await graphRows<{ sales_channels: { id: string }[] }>(
    container,
    "api_key",
    ["sales_channels.id"],
    { type: "publishable" },
  )
  results.push(
    same(
      "Publishable API keys linked to the sales channel",
      keys.map((key) => key.sales_channels.map((channel) => channel.id)),
      [[channelId]],
    ),
  )
  return results
}

async function catalogChecks(container: MedusaContainer) {
  const results: CheckResult[] = []
  const stock = await graphRows<{ id: string }>(container, "stock_location", [
    "id",
  ])

  const categories = await graphRows<{ handle: string; is_active: boolean }>(
    container,
    "product_category",
    ["handle", "is_active"],
  )
  results.push(
    same(
      "Categories",
      categories.map((c) => c.handle).sort(),
      CATEGORIES.map((c) => c.slug).sort(),
    ),
  )
  const collections = await graphRows<{ handle: string }>(
    container,
    "product_collection",
    ["handle"],
  )
  results.push(
    same(
      "Collections",
      collections.map((c) => c.handle).sort(),
      BRANDS.map((b) => b.slug).sort(),
    ),
  )

  const products = await graphRows<{
    handle: string
    status: string
    collection: { handle: string } | null
    categories: { handle: string }[]
    sales_channels: { id: string }[]
  }>(container, "product", [
    "handle",
    "status",
    "collection.handle",
    "categories.handle",
    "sales_channels.id",
  ])
  const well = products.filter((product) => {
    const source = PRODUCTS.find((p) => p.slug === product.handle)
    return (
      source &&
      product.status === "published" &&
      product.collection?.handle === source.brand &&
      product.categories.length === 1 &&
      product.categories[0].handle === source.category &&
      product.sales_channels.length === 1
    )
  })
  results.push(
    same(
      "Products (published, in the sales channel, 1 category, 1 collection)",
      [products.length, well.length],
      [PRODUCTS.length, PRODUCTS.length],
    ),
  )

  const variants = await variantRows(container)
  const expectedVariants = PRODUCTS.flatMap((product) => product.variants)
  results.push(
    same("Variants", variants.length, expectedVariants.length),
    same(
      "Variants with a pen price",
      variants.filter((variant) =>
        variant.price_set?.prices.some(
          (price) => price.currency_code === "pen",
        ),
      ).length,
      expectedVariants.filter((variant) => variant.priceCentimos !== undefined)
        .length,
    ),
    same(
      "Variants with manage_inventory on",
      variants.filter((variant) => variant.manage_inventory).length,
      expectedVariants.length,
    ),
    same(
      "Variants with allow_backorder on",
      variants.filter((variant) => variant.allow_backorder).length,
      expectedVariants.filter((variant) => variant.availability === "backorder")
        .length,
    ),
  )

  const levels = await graphRows<{ location_id: string }>(
    container,
    "inventory_level",
    ["location_id"],
  )
  results.push(
    same(
      "Inventory levels at the stock location",
      [
        levels.length,
        levels.filter((l) => l.location_id === stock[0]?.id).length,
      ],
      [expectedVariants.length, expectedVariants.length],
    ),
  )

  const specs = container.resolve<SpecsModuleService>(SPECS_MODULE)
  results.push(
    same(
      "Spec schemas / definitions / sheets",
      [
        (await specs.listSpecSchemas({}, { take: null })).length,
        (await specs.listSpecDefinitions({}, { take: null })).length,
        (await specs.listProductSpecSheets({}, { take: null })).length,
      ],
      [
        CATEGORIES.length,
        CATEGORIES.reduce((total, c) => total + c.specSchema.length, 0),
        PRODUCTS.length,
      ],
    ),
  )

  const editorial = container.resolve<EditorialModuleService>(EDITORIAL_MODULE)
  const rubrics = await editorial.listRubrics()
  results.push(
    same(
      "Rubrics / criteria / expert reviews",
      [
        rubrics.length,
        rubrics.reduce((total, rubric) => total + rubric.criteria.length, 0),
        (await editorial.listExpertReviews({}, { take: null })).length,
      ],
      [
        RUBRICS.length,
        RUBRICS.reduce((total, rubric) => total + rubric.criteria.length, 0),
        PRODUCTS.filter((product) => product.expertReview).length,
      ],
    ),
  )
  return results
}

async function demoChecks(container: MedusaContainer) {
  const results: CheckResult[] = []
  const skus = PRODUCTS.flatMap((product) =>
    product.variants
      .filter((variant) => variant.availability === "in_stock")
      .map((variant) => variant.sku),
  )
  const items = await graphRows<{
    sku: string
    location_levels: { stocked_quantity: number | string }[]
  }>(container, "inventory_item", ["sku", "location_levels.stocked_quantity"], {
    sku: skus,
  })
  results.push(
    same(
      `In-stock variants stocked at ${DEMO_STOCK}`,
      items.filter((item) =>
        item.location_levels.some(
          (level) => Number(level.stocked_quantity) === DEMO_STOCK,
        ),
      ).length,
      skus.length,
    ),
  )

  const customers = await graphRows<{
    id: string
    addresses: { address_name: string }[]
  }>(container, "customer", ["id", "addresses.address_name"], {
    email: DEMO_ACCOUNT.email,
  })
  results.push(
    same("Demo customers", customers.length, 1),
    same(
      "Demo addresses",
      (customers[0]?.addresses ?? []).map((a) => a.address_name).sort(),
      DEMO_ACCOUNT.addresses.map((a) => a.label).sort(),
    ),
    skipped(
      "Demo supplier and 7 offers",
      "the procurement module does not exist",
    ),
    skipped("Demo favorites", "the customer-product link is not defined yet"),
  )
  return results
}

/** The counts of the layers that ran (docs/seed-plan.md, "Counts"). */
export async function runCounts(
  container: MedusaContainer,
  layers: readonly Layer[],
  regime: Regime = REGIME_CONFIG.regime,
): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  if (layers.includes("reference")) {
    results.push(...(await referenceChecks(container)))
  }
  if (layers.includes("setup")) {
    results.push(...(await setupChecks(container, regime)))
  }
  if (layers.includes("catalog")) {
    results.push(...(await catalogChecks(container)))
  }
  if (layers.includes("demo")) {
    results.push(...(await demoChecks(container)))
  }
  return results
}

/**
 * The Apple line check: visible, never purchasable (ADR 0007, decision 4). It
 * lists every offending variant and never repairs.
 */
export async function runAppleCheck(
  container: MedusaContainer,
): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const brand = BRANDS.find((candidate) => candidate.slug === "apple")?.slug

  const collections = await graphRows<{ products: { handle: string }[] }>(
    container,
    "product_collection",
    ["products.handle"],
    { handle: brand },
  )
  results.push(
    same(
      "Apple collection holds exactly the 3 Apple products",
      (collections[0]?.products ?? []).map((product) => product.handle).sort(),
      [...APPLE_SLUGS].sort(),
    ),
  )

  const variants = (await variantRows(container)).filter((variant) =>
    APPLE_SLUGS.includes(variant.product.handle),
  )
  const list = (offending: VariantRow[]) =>
    offending.map((variant) => variant.sku).join(", ")
  const verdict = (name: string, offending: VariantRow[]) =>
    offending.length === 0
      ? pass(name, `${variants.length} variants`)
      : fail(name, `offending variants: ${list(offending)}`)

  results.push(
    same("Apple variants", variants.length, 25),
    verdict(
      "No Apple variant has a price in any currency",
      variants.filter((variant) => priceCount(variant) > 0),
    ),
    verdict(
      "Every Apple variant has manage_inventory on and allow_backorder off",
      variants.filter(
        (variant) => !variant.manage_inventory || variant.allow_backorder,
      ),
    ),
  )

  const items = await graphRows<{
    sku: string
    location_levels: { stocked_quantity: number | string }[]
  }>(container, "inventory_item", ["sku", "location_levels.stocked_quantity"], {
    sku: variants.map((variant) => variant.sku),
  })
  const stocked = items.filter((item) =>
    item.location_levels.some((level) => Number(level.stocked_quantity) > 0),
  )
  results.push(
    stocked.length === 0
      ? pass("No Apple inventory level above 0")
      : fail(
          "No Apple inventory level above 0",
          `offending variants: ${stocked.map((item) => item.sku).join(", ")}`,
        ),
    skipped(
      "No supplier offer on an Apple variant",
      "the procurement module does not exist",
    ),
    skipped(
      "variantAvailability is unavailable with max_quantity 0",
      "variantAvailability is not built yet (ADR 0007, F3b)",
    ),
  )

  if (REGIME_CONFIG.appleLinePurchasable) {
    return results.map((result) =>
      result.status === "fail"
        ? skipped(result.name, "skipped: Apple line purchasable")
        : result,
    )
  }
  return results
}

/** Throws one error that lists every failed check; passes otherwise. */
export function assertNoFailures(results: CheckResult[], what: string): void {
  const failed = failures(results)
  if (failed.length) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `${what} failed:\n${report(failed)}`,
    )
  }
}
