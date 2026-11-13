# Seed plan

What the Migeanje Store backend seeds, from which storefront fixture, with which Medusa workflow, and in which order. One script, `src/scripts/seed.ts`, runs with `npx medusa exec` ([Custom CLI scripts](https://docs.medusajs.com/learn/fundamentals/custom-cli-scripts)). It loads the store setup for Peru, the reference data of the custom modules, the 9 F1 categories, the 4 brands and the 19 products with their specs and expert reviews, and a demo layer for development. The Apple line is seeded visible and never purchasable.

- Status: Proposed — pending owner review
- Date: 2026-11-05
- Related: Engram #121 (seed order), #118 (R8, R9, R10), #107; [ADR 0001](adr/0001-money-representation.md), [ADR 0004](adr/0004-customer-auth.md), [ADR 0005](adr/0005-culqi-payments.md), [ADR 0007](adr/0007-availability-mapping.md), [ADR 0008](adr/0008-regime-flags.md); [data model](data-model/README.md)

## Quick path

1. Development: `npx medusa exec ./src/scripts/seed.ts` runs every layer.
2. Check: `npx medusa exec ./src/scripts/seed-check.ts` runs the counts and the Apple check. It exits non-zero on any failure.
3. Smoke test: with the backend running, the cart smoke test (see [Post-seed verification](#post-seed-verification)).
4. Production: `npx medusa exec ./src/scripts/seed.ts reference setup catalog`. No demo layer.

Arguments after the script path reach the script in `args` ([Custom CLI scripts](https://docs.medusajs.com/learn/fundamentals/custom-cli-scripts)). Selecting layers by argument is proposed; the alternative is one script per layer.

## Principles

| Principle | Rule |
|---|---|
| Idempotent | Every record has a natural key: handle, SKU, code, name or link pair. Each step looks the key up first. Missing: create. Present: keep it (setup, catalog, demo) or update it to the source value (reference). A second run creates nothing (proposed). |
| Re-runnable | Medusa documents no transaction around a script. Each step commits on its own, so a re-run completes a partial seed. |
| Layers apart | Reference, setup, catalog and demo data are separate layers (table below). Demo data never reaches production. |
| No secrets | No API keys, passwords or personal data in the seed or its data files. The demo password comes from an environment variable. Culqi keys stay in the provider options ([ADR 0005](adr/0005-culqi-payments.md)). |
| Money | Prices in major units, currency `pen` ([ADR 0001](adr/0001-money-representation.md)). The data files keep F1 céntimos. The seed converts them with the backend's shared céntimo converter (decimal parsing, never a float division). A price with a fraction of a céntimo fails the seed. |
| Regime | The seed reads `src/config/regime.ts` ([ADR 0008](adr/0008-regime-flags.md)) and never sets a flag. Under `nrus` the Peru tax region gets no default rate. |
| Apple line | Visible, never purchasable (R9, [ADR 0007](adr/0007-availability-mapping.md)). The seed check fails the run otherwise. |
| Admin edits win | The seed never overwrites stock, prices, shipping rates or copy the owner changed in the admin (proposed). |

The starter seed checks for existing records in three steps only (sales channel, shipping profile, publishable key) and creates the rest every time ([starter seed](https://github.com/medusajs/medusa-starter-default/blob/master/src/scripts/seed.ts)). This seed looks up every key.

## Layers

| Layer | Contents | Environments | Present record on re-run |
|---|---|---|---|
| `reference` | Ubigeo tree, holidays, refund reasons | All | Updated to the source: the official table wins |
| `setup` | Sales channel, store, region, tax region, price preference, stock location, shipping profile, service zones, shipping options, transit times, publishable key | All | Kept |
| `catalog` | Categories, brand collections, tags, products, variants, prices, inventory levels at 0, spec schemas and sheets, rubrics, expert reviews | All | Kept |
| `demo` | Demo stock, demo supplier and offers, demo customer, addresses, favorites | Development and staging. Refuses to run when `NODE_ENV` is `production` (proposed) | Kept |

Without the demo layer, in-stock variants have no stock and backorder variants have no offer. Both compute `unavailable` until the owner records real stock and real suppliers ([ADR 0007](adr/0007-availability-mapping.md), mapping rows 3–5).

## Data sources

The backend cannot import from the storefront repository. F3 copies the fixtures into typed data files under `src/scripts/seed-data/` (proposed). A test pins the counts: 9 categories, 4 brands, 19 products, 56 variants. Alternative: read the sibling storefront checkout at seed time. Not chosen: it ties the backend to a local path.

Storefront paths are relative to `MIGEANJE-STORE-APP/src/`.

| Data | Storefront source | Backend data file (proposed) |
|---|---|---|
| Categories and spec schemas | `modules/catalog/infrastructure/fixtures/categories.ts` | `seed-data/categories.ts` |
| Brands | `modules/catalog/infrastructure/fixtures/brands.ts` | `seed-data/brands.ts` |
| Products, variants, prices, specs, reviews | `chargers.ts`, `power-banks.ts`, `cables.ts`, `hubs-and-docks.ts`, `wireless-charging.ts`, `audio.ts`, `storage.ts`, `apple.ts` in the same folder; order in `index.ts` | `seed-data/products.ts`, without the Apple prices (R9) |
| Rubric criteria | `app/(transactional)/como-elegimos/rubric-criteria.ts`, keyed by category name | `seed-data/rubrics.ts`, keyed by category slug |
| Shipping rates and transit days | `modules/checkout/domain/shipping.ts` (`SHIPPING_RATES`, DRAFT) | `seed-data/shipping.ts` |
| Demo account | `modules/account/infrastructure/fixtures/demo-account.ts` | `seed-data/demo.ts`, without the password and its hash |
| Ubigeo | INEI's official table. The F1 `modules/checkout/infrastructure/fixtures/ubigeo.ts` is a subset and stays test data | `seed-data/ubigeo-inei-<version>.csv` |
| Holidays | Peru's official national holiday calendar, current and next year | `seed-data/holidays.ts` |
| Refund reasons | [ADR 0005](adr/0005-culqi-payments.md), decision 11 | `seed-data/refund-reasons.ts` |

## Steps

Steps 1–16 follow the starter seed order: sales channels, regions, tax regions, stock locations, stores, shipping profiles and options, API keys, categories, products, inventory levels (Engram #121, [starter seed](https://github.com/medusajs/medusa-starter-default/blob/master/src/scripts/seed.ts)). Steps marked "added" are not in the starter. Workflow names link to the [workflows reference](https://docs.medusajs.com/resources/medusa-workflows-reference). Links across modules use `link.create`, as the starter does.

### Medusa core

| # | Layer | What | Source | Workflow or service | Key |
|---|---|---|---|---|---|
| 1 | setup | Sales channel "Default Sales Channel", as the starter | — | [`createSalesChannelsWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createSalesChannelsWorkflow) | name |
| 2 | setup | Store: name "Migeanje Store", currency `pen` as default, default sales channel | — | `updateStoresStep` in a small workflow, as the starter's `updateStoreCurrencies`; [`updateStoresWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/updateStoresWorkflow) | the one store |
| 3 | setup | Region "Perú": `currency_code: "pen"`, `countries: ["pe"]`, `payment_providers: ["pp_culqi_culqi"]` | [ADR 0005](adr/0005-culqi-payments.md), [culqi](data-model/culqi.md) | [`createRegionsWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createRegionsWorkflow) | the region holding `pe` |
| 4 | setup | Tax region `pe`, `provider_id: "tp_system"` as the starter. No default rate under `nrus`; 18% named "IGV" under `b`. Created only when missing: the switch follows ADR 0008, decision 5 | [ADR 0008](adr/0008-regime-flags.md) | [`createTaxRegionsWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createTaxRegionsWorkflow) | country `pe` |
| 5 | setup | Added. Price preference `attribute: "currency_code"`, `value: "pen"`, `is_tax_inclusive: true` | [ADR 0008](adr/0008-regime-flags.md) | [`createPricePreferencesWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createPricePreferencesWorkflow) | attribute and value |
| 6 | reference | Added. Refund reasons `customer_request` "Pedido del cliente", `order_canceled` "Pedido cancelado", `return` "Devolución", `duplicate` "Cobro duplicado", `fraud` "Fraude" | [ADR 0005](adr/0005-culqi-payments.md) | [`createRefundReasonsWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createRefundReasonsWorkflow) (`code` and `label` required) | `code` |
| 7 | setup | Stock location "Almacén Lima" (`country_code: "PE"`, city Lima, no street) (proposed). Store `default_location_id`. Link to the fulfillment provider `manual_manual`, as the starter. Link to the sales channel | [ADR 0007](adr/0007-availability-mapping.md) | [`createStockLocationsWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createStockLocationsWorkflow), [`updateStoresWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/updateStoresWorkflow), `link.create`, [`linkSalesChannelsToStockLocationWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/linkSalesChannelsToStockLocationWorkflow) | name |
| 8 | setup | Shipping profile "Default Shipping Profile", `type: "default"` | — | [`createShippingProfilesWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createShippingProfilesWorkflow) | `type` |
| 9 | setup | Fulfillment set "Envíos Perú" (`type: "shipping"`) (proposed name), 3 service zones with province geo zones; linked to the stock location | [ubigeo-shipping](data-model/ubigeo-shipping.md) | `fulfillmentModuleService.createFulfillmentSets`, `link.create` | set name; zone name |
| 10 | setup | 3 flat shipping options (table below) | `SHIPPING_RATES` | [`createShippingOptionsWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createShippingOptionsWorkflow) | `type.code` |
| 11 | setup | Publishable API key "Storefront" (proposed title), linked to the sales channel. The key is public; the seed logs it once for the storefront environment | — | [`createApiKeysWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createApiKeysWorkflow), [`linkSalesChannelsToApiKeyWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/linkSalesChannelsToApiKeyWorkflow) | `type` and title |
| 12 | catalog | 9 categories, `is_active: true` | `categories.ts` | [`createProductCategoriesWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createProductCategoriesWorkflow) | `handle` |
| 13 | catalog | Added. 4 brand collections | `brands.ts` | [`createCollectionsWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createCollectionsWorkflow) (`title`, `handle`) | `handle` |
| 14 | catalog | Added. Product tags: every distinct value of the products' `tags` | product fixtures | [`createProductTagsWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createProductTagsWorkflow) (`value`) | `value` |
| 15 | catalog | 19 products, 56 variants, prices in `pen` (Apple: none), in F1 order | product fixtures | [`createProductsWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createProductsWorkflow) | product `handle`; variant `sku` |
| 16 | catalog | One inventory level per variant at "Almacén Lima", `stocked_quantity: 0` (proposed) | — | `query.graph` (`inventory_item`), [`createInventoryLevelsWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createInventoryLevelsWorkflow) | inventory item and location |

Step 3 needs the Culqi provider registered in `medusa-config` first. Medusa stores it as `pp_{identifier}_{id}` ([ADR 0005](adr/0005-culqi-payments.md)).

Step 16: a variant with `manage_inventory` on gets an inventory item created and linked by Medusa ([Product Variant Inventory](https://docs.medusajs.com/resources/commerce-modules/product/variant-inventory)). The step adds the level.

### Custom modules and links

| # | Layer | What | Source | Service | Key |
|---|---|---|---|---|---|
| 17 | reference | Ubigeo tree: 25 departamentos with `iso_3166_2`, their provincias and distritos | INEI table | ubigeo-shipping, generated create methods | `code` |
| 18 | reference | Holidays | official calendar | ubigeo-shipping | `date` |
| 19 | setup | 3 transit times, each linked to its shipping option | `SHIPPING_RATES` | ubigeo-shipping; `link.create` (`shipping_option` ↔ `transit_time`) | zone |
| 20 | catalog | 9 spec schemas with 75 definitions (F1 `order` becomes `rank`); each schema linked to its category | `categories.ts` | specs: generated create, `upsertDefinition`; `link.create` (`product_category` ↔ `spec_schema`) | category link; `key` per schema |
| 21 | catalog | 19 spec sheets with their values; each linked to its product | `specs` of each product | specs `upsertSheet`; `link.create` (`product` ↔ `product_spec_sheet`) | product link; definition per sheet |
| 22 | catalog | 6 rubrics with 30 criteria (list order becomes `rank`); each linked to its category | `rubric-criteria.ts` | editorial: generated create, `upsertCriterion`; `link.create` (`product_category` ↔ `review_rubric`) | category link; `name` per rubric |
| 23 | catalog | 8 expert reviews with their scores; each linked to its product | `expertReview` of 8 products | editorial `upsertReview`; `link.create` (`product` ↔ `expert_review`) | product link; criterion per review |

Steps 20–23 follow the seed sections of [specs](data-model/specs.md) and [editorial](data-model/editorial.md). Step 23 matches each F1 `criterion` text to a criterion of the category's rubric by name. An unknown name fails the seed, as the F1 test does today.

### Demo

| # | Layer | What | Source | Workflow or service | Key |
|---|---|---|---|---|---|
| 24 | demo | Stock 10 on each of the 24 in-stock variants. Set only while the level's `stocked_quantity` is 0 (proposed) | — | [`updateInventoryLevelsWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/updateInventoryLevelsWorkflow) | inventory item and location |
| 25 | demo | Supplier "Importador local (demo)", type `local_importer`, no RUC | [procurement](data-model/procurement.md) | procurement | `name` |
| 26 | demo | 7 offers, one per backorder variant: 15–20 business days, `priority` 0, active, no cost; each linked to its variant | `BACKORDER` in `helpers.ts` | procurement; `link.create` (`product_variant` ↔ `supplier_offer`) | variant and supplier |
| 27 | demo | Customer `demo@migeanje.pe` | `demo-account.ts` | `authModuleService.register("emailpass", …)` ([register](https://docs.medusajs.com/resources/references/auth/register)), then [`createCustomerAccountWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createCustomerAccountWorkflow) (`authIdentityId`, `customerData`) | email |
| 28 | demo | 2 customer addresses | `demo-account.ts` | [`createCustomerAddressesWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createCustomerAddressesWorkflow) | customer and `address_name` |
| 29 | demo | 2 favorites | `demo-account.ts` | `link.create` (`customer` ↔ `product`, extra column `favorited_at`) | customer and product |
| 30 | all | Seed check: the Apple line and the counts | — | read-only `query.graph` | — |

### Shipping zones and options (steps 9, 10, 19)

| Service zone | Geo zones (type province) | Option `type.code` | Price | Transit |
|---|---|---|---|---|
| "Lima Metropolitana" | `pe-lma` | `lima_metro` | 10 `pen` | 1–2 business days |
| "Callao" | `pe-cal` | `callao` | 12 `pen` | 1–2 business days |
| "Resto del Perú" | the other 24 codes, `pe-lim` included | `rest_of_peru` | 20 `pen` | 3–5 business days |

- Option names repeat the zone labels (proposed).
- Every option: `price_type: "flat"`, `provider_id: "manual_manual"`, rules `enabled_in_store` = `"true"` and `is_return` = `"false"`, as the starter.
- `type.code` is the F1 `ShippingZone`. It keys the option and its transit time.
- Rates and transit days are DRAFT (R10). The owner edits prices in the admin, and the seed never overwrites them.

### Product mapping (step 15)

| F1 field | Medusa field | Notes |
|---|---|---|
| `slug` | `handle` | Key |
| `name` | `title` | |
| `summary` | `description` | Proposed. Alternative: `subtitle` |
| `model` | `subtitle` | Proposed. 17 products have one; the MacBook and the iPad do not. Alternatives: a "Modelo" spec in every schema, or no field (F1 search and the product page `mpn` lose it) |
| `brand` | collection of the brand | `collection_id` |
| `category` | one category | `category_ids` |
| `tags` | product tags | `tag_ids` |
| `images` | none | Proposed. F1 images are storefront placeholder SVGs. Alternative: `thumbnail` with the placeholder's URL |
| `options` | `options`, titled with the F1 `label` | Proposed: "Color", "Longitud", "Chip", "Memoria unificada", "Almacenamiento". 10 products have no options |
| `variants[].sku` | `sku` | Key |
| `variants[].options` | variant `options`, keyed by option title | |
| — | variant `title` | Proposed: option values joined with " / "; the product title for a single variant |
| `variants[].price` | `prices: [{ amount, currency_code: "pen" }]` | Major units. Apple: `[]`; `prices` is optional |
| `variants[].availability` | `manage_inventory: true` on every variant; `allow_backorder: true` only for `backorder` | Medusa's default for `manage_inventory` is off ([Product Variant Inventory](https://docs.medusajs.com/resources/commerce-modules/product/variant-inventory)), so the seed sets it on every variant. Status itself is computed ([ADR 0007](adr/0007-availability-mapping.md)) |
| — | `status: "published"`, `sales_channels`, `shipping_profile_id` | Apple products are published too: they show "Avísame" |
| `specs` | specs module | Step 21 |
| `expertReview` | editorial module | Step 23 |
| featured order | creation order | Proposed: products are created in F1 order, so `created_at` follows "featured". See open items |

No fixture has `compareAt`, so no price lists are seeded. The Product model fields used are in the [Product reference](https://docs.medusajs.com/resources/references/product/models/Product).

## Categories

| # | Slug | Name | Spec definitions | Spec schema seeded | Rubric seeded |
|---|---|---|---|---|---|
| 1 | `cargadores` | Cargadores | 8 | Yes | Yes, 4 criteria |
| 2 | `power-banks` | Power banks | 10 | Yes | Yes, 4 criteria |
| 3 | `cables` | Cables | 7 | Yes | No |
| 4 | `hubs-y-docks` | Hubs y docks | 10 | Yes | Yes, 4 criteria |
| 5 | `carga-inalambrica` | Carga inalámbrica | 7 | Yes | Yes, 6 criteria |
| 6 | `audio` | Audio | 9 | Yes | Yes, 4 criteria |
| 7 | `almacenamiento` | Almacenamiento | 9 | Yes | Yes, 8 criteria |
| 8 | `laptops` | Laptops | 8 | Yes | No |
| 9 | `tablets` | Tablets | 7 | Yes | No |

Totals: 9 schemas, 75 definitions, 6 rubrics, 30 criteria. Cables, laptops and tablets have no criteria and no reviews in F1, so they get no rubric until the owner writes one ([editorial](data-model/editorial.md)).

## Products

Availability is what `variantAvailability` returns after the full development seed. Stock is the demo layer's quantity per variant. Prices are major units in `pen`.

| # | Slug | Brand collection | Category | Variants | Availability | `manage_inventory` | `allow_backorder` | Stock | Supplier offer | PEN price | Specs | Expert review |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `anker-nano-charger-45w-smart-display` | `anker` | `cargadores` | 4 | `backorder` | On | On | 0 | Yes, 15–20 days | 248.90 | Yes | No |
| 2 | `anker-prime-charger-100w-3-puertos` | `anker` | `cargadores` | 1 | `in_stock` | On | Off | 10 | No | 189.90 | Yes | Yes |
| 3 | `anker-prime-charger-160w-3-puertos-smart-display` | `anker` | `cargadores` | 1 | `backorder` | On | On | 0 | Yes, 15–20 days | 349.90 (estimated) | Yes | No |
| 4 | `anker-maggo-power-bank-10k-slim` | `anker` | `power-banks` | 4 | `in_stock` | On | Off | 10 | No | 199.90 | Yes | No |
| 5 | `anker-prime-power-bank-20k-220w` | `anker` | `power-banks` | 1 | `in_stock` | On | Off | 10 | No | 648.90 | Yes | No |
| 6 | `ugreen-nexode-power-bank-25000mah-200w` | `ugreen` | `power-banks` | 1 | `in_stock` | On | Off | 10 | No | 328.90 | Yes | Yes |
| 7 | `anker-prime-cable-usb-c-240w-trenzado` | `anker` | `cables` | 2 | `in_stock` | On | Off | 10 | No | 89.90 / 99.90 (estimated) | Yes | No |
| 8 | `ugreen-cable-usb-c-a-lightning-mfi-trenzado` | `ugreen` | `cables` | 2 | `in_stock` | On | Off | 10 | No | 54.90 / 78.90 | Yes | No |
| 9 | `ugreen-revodok-pro-210-10-en-1` | `ugreen` | `hubs-y-docks` | 1 | `backorder` | On | On | 0 | Yes, 15–20 days | 198.90 | Yes | Yes |
| 10 | `ugreen-revodok-max-213-thunderbolt-4-13-en-1` | `ugreen` | `hubs-y-docks` | 1 | `backorder` | On | On | 0 | Yes, 15–20 days | 949.90 (estimated) | Yes | No |
| 11 | `anker-maggo-estacion-de-carga-3-en-1-plegable` | `anker` | `carga-inalambrica` | 4 | `in_stock` | On | Off | 10 | No | 399.90 | Yes | Yes |
| 12 | `ugreen-magflow-qi2-25w-2-en-1-plegable` | `ugreen` | `carga-inalambrica` | 1 | `in_stock` | On | Off | 10 | No | 188.90 | Yes | Yes |
| 13 | `soundcore-liberty-5` | `soundcore` | `audio` | 4 | `in_stock` | On | Off | 10 | No | 189.90 | Yes | Yes |
| 14 | `soundcore-space-one-pro` | `soundcore` | `audio` | 2 | `in_stock` | On | Off | 10 | No | 419.90 | Yes | No |
| 15 | `ugreen-nasync-dxp4800-plus` | `ugreen` | `almacenamiento` | 1 | `in_stock` | On | Off | 10 | No | 3,499.90 | Yes | Yes |
| 16 | `ugreen-carcasa-ssd-m2-nvme-10gbps` | `ugreen` | `almacenamiento` | 1 | `in_stock` | On | Off | 10 | No | 138.90 | Yes | Yes |
| 17 | `macbook-air-13-m5` | `apple` | `laptops` | 8 | `unavailable` | On | Off | 0 | No | No | Yes | No |
| 18 | `ipad-air-11-m4` | `apple` | `tablets` | 16 | `unavailable` | On | Off | 0 | No | No | Yes | No |
| 19 | `airpods-pro-3` | `apple` | `audio` | 1 | `unavailable` | On | Off | 0 | No | No | Yes | No |

Totals:

- 56 variants: 24 `in_stock`, 7 `backorder`, 25 `unavailable` (Apple).
- 31 variants with a `pen` price. 7 supplier offers. 19 spec sheets. 8 expert reviews.
- Brands: `anker` 7, `ugreen` 7, `soundcore` 2, `apple` 3.
- "(estimated)" repeats the F1 fixture comments: no Peru reference price was found.

## Keeping the Apple line non-purchasable

The three barriers of [ADR 0007](adr/0007-availability-mapping.md), decision 4:

| Barrier | What the seed does | What stops a purchase |
|---|---|---|
| 1. Regime gate on the `apple` collection | Puts the 3 Apple products in `apple`. `apple_line_purchasable` is code configuration, off under `nrus` ([ADR 0008](adr/0008-regime-flags.md)) | `variantAvailability` row 1 returns `unavailable` with `max_quantity` 0, whatever the data says. The cart hooks reject with `variant_unavailable` |
| 2. No PEN price | Creates the variants with `prices: []`. The F1 Peru reference prices are dropped from the data file (R9) | `validateLineItemPricesStep` in `addToCartWorkflow` rejects a line without a price |
| 3. No stock and no offers | `manage_inventory` on, `allow_backorder` off, one level with `stocked_quantity: 0`, no supplier offer | `confirmVariantInventoryWorkflow` rejects; mapping rows 3 and 4 never hold |

`manage_inventory` must be on. Off, Medusa treats a variant as always in stock, and barrier 3 disappears.

### Seed check: Apple line

It runs at the end of every seed run and in `seed-check.ts`. It fails with a non-zero exit and lists every offending variant. It never repairs (proposed): a repair would silently undo a change made in the admin. Alternative: delete the offending prices, stock and offers.

- [ ] The `apple` collection holds exactly `macbook-air-13-m5`, `ipad-air-11-m4` and `airpods-pro-3`.
- [ ] No variant of those products has a price in any currency.
- [ ] Every variant has `manage_inventory` on and `allow_backorder` off.
- [ ] No inventory level of those variants has `stocked_quantity` above 0.
- [ ] No supplier offer is linked to those variants.
- [ ] `variantAvailability` returns `unavailable` with `max_quantity` 0 for all 25 variants.
- [ ] `apple_line_purchasable` is off. Once regime B turns it on ([ADR 0008](adr/0008-regime-flags.md), decision 5, step 9), the check reports "skipped: Apple line purchasable" instead of failing.

## Demo data

Development and staging only. The account is public by design: anyone who knows the password can sign in, so it never exists in production (proposed).

### Demo account

| F1 field | Seeded as |
|---|---|
| `email`: `demo@migeanje.pe` | `emailpass` auth identity and customer email |
| Password | `SEED_DEMO_PASSWORD` environment variable, 8 to 128 characters ([ADR 0004](adr/0004-customer-auth.md)). The step refuses to run without it. The F1 hash is not ported: Medusa hashes on register |
| `firstName` "Lucía", `lastName` "Demo" | `first_name`, `last_name` |
| `phone` "900000000" | `phone` |
| `emailVerifiedAt` | Verified, as [ADR 0004](adr/0004-customer-auth.md) requires. How a script marks an identity verified is not documented. Not verified; F3 spike. Fallback: verify once through the development mailbox |
| `document`: DNI 00000000 | Not seeded. Medusa customers have no document field, and no data model page places one (open items) |
| `id`, `createdAt` | Not ported. Medusa assigns them |

### Addresses

Mapped as [ubigeo-shipping](data-model/ubigeo-shipping.md) defines. Every address has `country_code: "pe"` and the customer's first and last name. Step 17 must run first: `province` comes from `subdivisionOf(postal_code)`.

| `address_name` | `address_1` | `address_2` | `city` | `province` | `postal_code` | Default |
|---|---|---|---|---|---|---|
| Casa | Av. José Pardo 500, dpto. 302 | Cerca al óvalo Gutiérrez | Miraflores | `pe-lma` | `150122` | `is_default_shipping` |
| Oficina | Calle Mercaderes 210, oficina 4 | — | Arequipa | `pe-are` | `040101` | — |

### Favorites

- `anker-prime-charger-100w-3-puertos` and `soundcore-liberty-5`, linked after the products and the customer exist ([customer favorites](data-model/customer-favorites.md)).
- F1 lists favorites newest first. The first gets the later `favorited_at`, one minute apart (proposed).
- If the customer ↔ product link is not supported, the fallback `customer_favorite` model takes the same two rows.

### Demo orders: not seeded (proposed)

- Medusa creates an order only by completing a cart, and `completeCartWorkflow` authorizes its payment ([ADR 0002](adr/0002-order-number.md), [ADR 0005](adr/0005-culqi-payments.md)).
- Culqi charges need a token from Culqi's own component (R1). A script has no card entry to produce one.
- The F1 numbers `MG-2026-480315`, `MG-2026-275904` and `MG-2026-913628` are random. Under ADR 0002 the number comes from `display_id`, so they cannot be kept.
- Their statuses need fulfillments, a shipment, a delivery and a procurement item ([ADR 0003](adr/0003-order-status-projection.md)).

F4 creates test orders end to end with Culqi sandbox cards. The storefront's demo tracking hint stays a mock-only feature.

Alternative: a development-only script, `seed-demo-orders.ts`, that runs the real flow for the three F1 orders:

1. [`createCartWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createCartWorkflow) with the F1 lines: Revodok Pro 210 and the 240 W cable (Cayma), the Prime Charger 100W (Miraflores), 2 Lightning cables (Bellavista).
2. Address and shipping method.
3. A payment session with Medusa's system provider `pp_system_default` (the starter's region uses it), enabled only in the development region.
4. [`completeCartWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/completeCartWorkflow). The `order.placed` subscriber creates the procurement item of the hub.
5. [`createOrderFulfillmentWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createOrderFulfillmentWorkflow), [`createOrderShipmentWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/createOrderShipmentWorkflow) and [`markOrderFulfillmentAsDeliveredWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/markOrderFulfillmentAsDeliveredWorkflow) for the two later orders.

Cost: a second payment provider in the development region; dates are the run's "now"; numbers differ per database; each order needs its boleta receipt request in sunat-billing.

## Not seeded

| Data | Why |
|---|---|
| sunat-billing rows | Comprobantes come from orders, cap alerts from the job. Regime flags are code ([sunat-billing](data-model/sunat-billing.md)) |
| culqi rows | Records come only from the reconciliation job ([culqi](data-model/culqi.md)) |
| complaints rows | The first filing of a year creates its counter. Development sheets are filed through the route ([complaints](data-model/complaints.md)) |
| Supplier purchases, procurement items, restock requests | Created by orders, the owner and the "Avísame" route ([procurement](data-model/procurement.md)) |
| Home and trust page copy | Storefront code ([editorial](data-model/editorial.md)) |
| Product images | Placeholders only in F1 (product mapping above) |

## Post-seed verification

`seed-check.ts` runs the counts and the Apple check (proposed). It is read-only.

### Counts

| Record | Expected |
|---|---|
| Sales channels | 1 |
| Regions | 1: `pe`, `pen`, `pp_culqi_culqi` enabled |
| Tax regions | 1: `pe`, no default rate under `nrus` |
| Price preferences | 1: `pen`, tax-inclusive |
| Refund reasons | 5 |
| Stock locations | 1, linked to the sales channel |
| Service zones / shipping options | 3 / 3 (10, 12 and 20 `pen`), each option linked to a transit time |
| Publishable API keys | 1, linked to the sales channel |
| Categories | 9 |
| Collections | 4: `anker`, `ugreen`, `soundcore`, `apple` |
| Products | 19, all `published`, all in the sales channel, each in one category and one collection |
| Variants | 56. 31 with a `pen` price. 56 with `manage_inventory` on. 7 with `allow_backorder` on |
| Inventory levels | 56, all at "Almacén Lima" |
| Spec schemas / definitions / sheets | 9 / 75 / 19 |
| Rubrics / criteria / expert reviews | 6 / 30 / 8 |
| Ubigeo departamentos | 25, each with `iso_3166_2`. Provincias and distritos as the pinned INEI version |
| Holidays | As the pinned list |
| Demo layer | 24 variants stocked at 10; 1 supplier; 7 offers; 1 customer; 2 addresses; 2 favorites |

### Availability

`variantAvailability` for every variant after the development seed:

- 24 `in_stock`, `max_quantity` 5.
- 7 `backorder`, lead time 15–20, `max_quantity` 2.
- 25 `unavailable`, `max_quantity` 0.

### Re-run

Run the seed twice. The second run creates nothing and changes nothing; every count stays equal.

### Cart smoke test

Against the running backend's store API, with the publishable key, as the storefront calls it. Routes per the contract map (T8). Proposed as a script, `seed-smoke.ts`.

1. Create a cart in the "Perú" region.
2. Add 1 × `ANK-A2688`: accepted, unit price 189.90 `pen`, no tax lines under `nrus` (ADR 0008 spike).
3. Set the Casa address: exactly one shipping option, "Lima Metropolitana", 10 `pen`.
4. Raise `ANK-A2688` to 6: rejected with `quantity_limit`.
5. Add 3 × `UGR-15534` (backorder): rejected with `quantity_limit`. 2 are accepted.
6. Add 1 × `APL-MFHP4`: rejected with `variant_unavailable`. Before the hooks exist, Medusa's price check rejects it.
7. Stop before payment. Completing needs a Culqi token; the end-to-end checkout is F4.

Steps 4 and 5 need the F3 cart hooks ([ADR 0007](adr/0007-availability-mapping.md), decision 5).

## Open items

### Proposed choices for owner review

| Choice | Alternative | Why this one |
|---|---|---|
| Re-runs keep existing setup, catalog and demo records; only reference data is updated | Full upsert from the data files | An upsert would overwrite prices, stock and copy edited in the admin |
| Four layers selected by argument; demo refuses production | One script per layer | One entry point, one order of steps |
| Fixtures copied into backend data files | Read the storefront checkout at seed time | No dependency on a local sibling path |
| Demo stock: 10 per in-stock variant | The starter's 1,000,000 | 10 still lets the 5-per-line limit apply, and stock stays visible |
| A level at 0 for backorder and Apple variants | No level | Explicit and easy to check. Medusa's behavior with a missing level is not verified |
| `summary` → `description`; `model` → `subtitle`; no images; option titles from F1 labels; variant titles from option values | See the product mapping table | Core fields only; no business data in metadata (Engram #18) |
| "Featured" order from creation order | A rank field (contract map) | No new field until T8 decides |
| Demo orders not seeded | `seed-demo-orders.ts` with the system payment provider | No second payment provider; F4 tests the real flow |
| The Apple check fails, never repairs | Repair by deleting prices, stock and offers | A repair hides an admin mistake |
| Names "Almacén Lima", "Envíos Perú", API key "Storefront" | Any other | Admin labels only |
| The demo customer exists only in development and staging | Also in production | A known password on production is an open account |

### F3 spikes

- Whether `createProductsWorkflow` accepts a product without options (10 products have none). Fallback: one default option.
- The input names `category_ids`, `collection_id` and `tag_ids`: they are not listed on the workflow page. F3 checks them against the installed types.
- How a script marks the demo auth identity verified.
- Whether the store product routes return the Apple variants without a `pen` price (no `calculated_price`) or hide them. If hidden, the storefront needs a custom route for the Apple line.
- A tax region without a default rate computes zero tax ([ADR 0008](adr/0008-regime-flags.md)).
- `manual_manual` is registered in a new project, as the starter assumes.
- Medusa's stock check when a variant has no inventory level.
- The linkable keys for categories, shipping options and customers (data model pages).
- The INEI publication and version to pin ([ubigeo-shipping](data-model/ubigeo-shipping.md)).

### Owner questions

- Estimated prices: `ANK-A2687` (349.90), both variants of `anker-prime-cable-usb-c-240w-trenzado` (89.90, 99.90) and `UGR-25054A` (949.90). Confirm them before the catalog layer runs in production.
- Real stock counts and real suppliers replace the demo layer before launch.
- Shipping rates and transit days are DRAFT (R10).
- The stock location's address, entered in the admin.

### Gaps in other F2 documents

- The account's identity document (DNI or CE) has no home: Medusa customers have no field for it, and no data model page places it. F1 uses it to prefill checkout.
- F1's "featured" sort has no field in Medusa or in the data model. The contract map (T8) decides.
- F1 `model` (manufacturer part number) has no field in the data model. This plan proposes `subtitle`.
