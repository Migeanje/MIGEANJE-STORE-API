# ubigeo-shipping module

The ubigeo-shipping module owns Peru's ubigeo tree (INEI departamentos, provincias and distritos), the rule that maps an address to a shipping zone, the transit days per shipping option, the business-day calendar and the delivery estimate of each order. It does not own shipping prices: those are Medusa shipping option prices in major units with currency `pen` ([ADR 0001](../adr/0001-money-representation.md), decision 2). It does not own addresses, carts or orders. The order routes of [ADR 0003](../adr/0003-order-status-projection.md) show its delivery estimate.

## Models

Medusa adds `created_at`, `updated_at` and `deleted_at` to every data model; soft delete sets `deleted_at` ([Data model properties](https://docs.medusajs.com/learn/fundamentals/data-models/properties)). The tables below leave them out. Every ID uses `model.id({ prefix })` ([id property](https://docs.medusajs.com/resources/references/data-model/property-types/id)). Unique indexes are partial, `where deleted_at` is null ([Indexes](https://docs.medusajs.com/learn/fundamentals/data-models/index)).

### `ubigeo_departamento` (ID prefix `ubidep`)

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `code` | `text` | unique; check `^\d{2}$` | INEI code, e.g. `15`. Callao is `07` |
| `name` | `text` | not blank | "Lima" |
| `iso_3166_2` | `text` | unique; lowercase; check `^pe-[a-z]{3}$` | ISO 3166-2 subdivision: `15` → `pe-lim`, `07` → `pe-cal` |
| `provincias` | `hasMany(ubigeo_provincia)` | at least one (seed check) | |

### `ubigeo_provincia` (ID prefix `ubiprov`)

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `departamento` | `belongsTo(ubigeo_departamento)` | required | |
| `code` | `text` | unique; check `^\d{4}$`; starts with the departamento code (seed check) | `1501` is Lima Metropolitana |
| `name` | `text` | not blank | |
| `distritos` | `hasMany(ubigeo_distrito)` | at least one (seed check) | |

### `ubigeo_distrito` (ID prefix `ubidist`)

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `provincia` | `belongsTo(ubigeo_provincia)` | required | |
| `code` | `text` | unique; check `^\d{6}$`; starts with the provincia code (seed check) | e.g. `150122` |
| `name` | `text` | not blank | |

The tree is reference data: the seed writes it, nothing edits it at runtime.

### `transit_time` (ID prefix `trtime`)

The courier's time for one shipping option. F1: `SHIPPING_RATES[zone].transitDays` (DRAFT).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `zone` | `enum` | `lima_metro`, `callao`, `rest_of_peru` | F1 `ShippingZone`. Labels: "Lima Metropolitana", "Callao", "Resto del Perú" |
| `min_days` | `number` | ≥ 0 | Business days |
| `max_days` | `number` | ≥ `min_days` (check) | Business days |

### `holiday` (ID prefix `hday`)

A non-working day skipped by business-day math (proposed). Closes the F1 gap "public holidays are not skipped yet" (R10).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `date` | `text` | unique; check `^\d{4}-\d{2}-\d{2}$` | A Lima calendar date, not an instant, so not `dateTime` |
| `name` | `text` | not blank | e.g. "Fiestas Patrias" |

### `delivery_estimate` (ID prefix `dlvest`)

What the store promised when the order was placed. F1: `Order.shipping` and `Order.estimatedDelivery`. A snapshot, so later changes to transit times or holidays do not move a promised date.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `zone` | `enum` | as in `transit_time` | |
| `transit_min_days` | `number` | ≥ 0 | |
| `transit_max_days` | `number` | ≥ `transit_min_days` (check) | |
| `lead_time_min_days` | `number` | nullable; both lead time fields null or both set (check) | Longest backorder lead time; null without backorder lines |
| `lead_time_max_days` | `number` | nullable; ≥ `lead_time_min_days` (check) | |
| `delivery_from` | `text` | check `^\d{4}-\d{2}-\d{2}$` | Lima date: order date plus transit plus lead time minimums, in business days |
| `delivery_to` | `text` | same check; ≥ `delivery_from` (service rule) | Same with the maximums |

The module stores no money. Rates live in Medusa (see "How checkout uses it").

## Module links

Links use `defineLink` ([Module links](https://docs.medusajs.com/learn/fundamentals/module-links)).

| Link | Other side | Cardinality | Options | Why |
|---|---|---|---|---|
| `shipping_option` ↔ `transit_time` | Fulfillment Module, shipping option | one-to-one | none | Transit belongs to the option the customer picks. A future express option gets its own row |
| `order` ↔ `delivery_estimate` | Order Module, order | one-to-one | none | The tracking, confirmation and account order routes read it with the order |

The docs show only `ProductModule.linkable.product`. The keys for shipping options and orders are not verified; F3 spike.

## Service operations

The port other code calls. Generated CRUD methods follow the service factory names ([list method](https://docs.medusajs.com/resources/service-factory-reference/methods/list)).

- `tree()`: departamentos with provincias and distritos, sorted by code. The F1 port `UbigeoDirectory.tree` maps to it one-to-one.
- `resolve({ departamento, provincia, distrito })`: the three places when the codes exist and nest, else null (F1 `resolveUbigeo`).
- `resolveDistrito(distritoCode)`: the same from the 6-digit code alone. Addresses carry only that code (see below).
- `zoneOf(distritoCode)`: the F1 rule, kept in code: provincia `1501` → `lima_metro`; departamento `07` → `callao`; otherwise `rest_of_peru`.
- `subdivisionOf(distritoCode)`: the address `province` value: `pe-lma` for provincia `1501`, else the departamento's `iso_3166_2`.
- `transitFor(shippingOptionId)`: zone and transit days, through the link.
- `addBusinessDays(date, days)`: skips Saturdays, Sundays and `holiday` dates. Dates are Lima calendar dates (`YYYY-MM-DD`); timestamps stay UTC (Engram #18).
- `estimateDelivery({ placedAt, transit, leadTimeDays })`: delivery days (transit plus lead time) and the `from` / `to` dates (F1 `quoteShipping` plus `deliveryWindow`).

### How checkout uses it (proposed)

Medusa geo zones match by country, province (ISO 3166-2), city or postal code (Engram #121), and province codes are lowercase ISO 3166-2 ([Fulfillment concepts](https://docs.medusajs.com/resources/commerce-modules/fulfillment/concepts)). ISO 3166-2:PE has a code for Lima Metropolitana (`PE-LMA`) and one for Callao (`PE-CAL`) ([ISO 3166-2:PE](https://en.wikipedia.org/wiki/ISO_3166-2:PE)). So the three F1 zones fit Medusa's own geo zones, and no provider with calculated prices is needed:

| Service zone | Geo zones (type province) | Shipping option price |
|---|---|---|
| "Lima Metropolitana" | `pe-lma` | 10 `pen` (F1 1000 céntimos, DRAFT) |
| "Callao" | `pe-cal` | 12 `pen` (F1 1200, DRAFT) |
| "Resto del Perú" | the other 24 codes, `pe-lim` included | 20 `pen` (F1 2000, DRAFT) |

Each zone has one flat shipping option (`price_type` `flat`). The owner edits prices in the Medusa admin.

The Medusa address carries the ubigeo like this (proposed; [cart Address model](https://docs.medusajs.com/resources/references/cart/models/Address)):

| Address field | Value | Example |
|---|---|---|
| `country_code` | `pe` | `pe` |
| `province` | `subdivisionOf(distrito)` | `pe-lma` |
| `city` | Distrito name | "Miraflores" |
| `postal_code` | Distrito ubigeo, 6 digits | `150122` |
| `address_1` | F1 `line` | "Av. Larco 123, dpto. 401" |
| `address_2` | F1 `reference` | "Frente al parque" |

Departamento and provincia names come from `resolveDistrito(postal_code)`.

Checkout steps:

1. The contact step validates the codes with `resolve` and writes the address as above.
2. Medusa lists the cart's shipping options (`sdk.store.fulfillment.listCartOptions({ cart_id })`, [checkout shipping step](https://docs.medusajs.com/resources/storefront-development/checkout/shipping)). The province leaves one option.
3. A custom route returns the delivery estimate for the cart: transit of that option plus the longest backorder lead time of the cart lines. Lead times come from `variantAvailability` ([ADR 0007](../adr/0007-availability-mapping.md)); like F1, the minimum is the largest line minimum and the maximum the largest line maximum.
4. The storefront adds the shipping method with that `option_id`.
5. Guard: a `completeCartWorkflow.hooks.validate` handler (Engram #121) refuses the order unless `postal_code` is a known distrito, `province` equals `subdivisionOf(postal_code)`, and the shipping method's option is linked to the zone `zoneOf(postal_code)`. A client cannot pay the Lima rate for an Arequipa address.
6. A subscriber on `order.placed` writes the `delivery_estimate` and links it to the order. Lead times must match the ones the procurement items copy at placement (ADR 0007, decision 3). Proposed: one `order.placed` workflow creates both, so neither reads the other before it exists.

### Store routes that need this module

| Storefront page | Needs |
|---|---|
| `/checkout/contacto` | Ubigeo tree (address selects, server validation) |
| `/cuenta/direcciones` | Ubigeo tree (address book form) |
| `/libro-de-reclamaciones` | Ubigeo tree (consumer address, `ResolvedUbigeo` in the complaint) |
| `/checkout/*` summary | Shipping options of the cart (standard), delivery estimate of the cart (custom) |
| `/envios-y-devoluciones` | Rate table: zone name, price, transit days. No cart, so a custom route |
| `/checkout/confirmacion/[number]`, `/pedidos/seguimiento`, `/cuenta/pedidos` | The order's `delivery_estimate` |

Proposed custom routes: `GET /store/ubigeo` (whole tree, cacheable), `GET /store/shipping-rates`, `GET /store/carts/:id/delivery-estimate`. The contract map (T8) fixes the names.

## Events

- Emitted: none.
- Consumed: `order.placed`, payload `{ id }` ([Events reference](https://docs.medusajs.com/resources/references/events)). The reference says it is also emitted when a draft order is converted to an order.

## Seed and data sources

- Ubigeo tree (proposed source): INEI's official ubigeo table, all departamentos, provincias and distritos. F3 pins the publication and records its version in the seed. The F1 fixture (`src/modules/checkout/infrastructure/fixtures/ubigeo.ts`) is a subset: all 25 departamentos, but only some provincias and distritos. It stays as test data.
- ISO 3166-2 codes: one per departamento, from ISO 3166-2:PE (25 regions plus `pe-lma`).
- Service zones, geo zones and the three flat shipping options: the Medusa seed, in the starter order (stock locations, shipping profiles, then shipping options; Engram #121). Prices from F1 `SHIPPING_RATES` in major units.
- Transit times: F1 `SHIPPING_RATES` (1–2, 1–2 and 3–5 business days, DRAFT), linked to their options with `link.create`.
- Holidays: Peru's national holidays for the current and next year, from the official calendar (proposed).

## Open items

- F3 spike: how Medusa compares the cart's `shipping_address.province` with a geo zone's `province_code` when listing options. Not verified. If it fails, use the alternative below.
- F3 spike: whether adding a shipping method checks that the option fits the address. The guard in step 5 covers it either way.
- F3 spike: the linkable keys for shipping options and orders.
- F3 spike: the INEI publication to load and its distrito count. Community sources say RENIEC uses different codes; F1 uses INEI.
- F3 spike: whether the confirmation page can load before the `order.placed` subscriber finishes. If so, the order routes compute the estimate from the order's shipping method and lines (same inputs).
- Proposed: Medusa flat options with province geo zones. Alternatives: one option with `price_type` `calculated` and a custom fulfillment provider. Its `canCalculate(data)` and `calculatePrice(optionData, data, context)` get the cart's `shipping_address` and `items` and return `calculated_amount` and `is_calculated_price_tax_inclusive` ([Fulfillment provider](https://docs.medusajs.com/resources/references/fulfillment/provider)). Needed only when a rate depends on the distrito. Cost: the rates would live in the module as `bigNumber` plus `currency_code`, and the provider runs inside the Fulfillment Module. A module cannot resolve other modules' services ([Module isolation](https://docs.medusajs.com/learn/fundamentals/modules/isolation)); whether a provider can is not documented. F3 spike if chosen.
- Proposed: `postal_code` carries the distrito ubigeo. Alternatives: `metadata` (no business data in metadata, Engram #18), or a link on the address (cart addresses are copied into the order, so a link would not follow). F1 never asks for Peru's 5-digit postal code.
- Proposed: the tree lives in the database. Alternatives: a JSON file bundled with the module; no seed, but the admin and Query cannot read it.
- Proposed: the `holiday` table. Alternatives: no holidays (F1 behavior, estimates a day or two early around them) or a list in code.
- F3 spike: which fulfillment provider the flat options use (the starter seed's default provider). Not verified.
- R10: rates and transit times are DRAFT, as in F1. The owner confirms them before launch.
