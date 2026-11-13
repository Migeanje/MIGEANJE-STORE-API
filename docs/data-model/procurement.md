# procurement module

The procurement module owns how the store buys what it sells on order: suppliers and their purchase policy, the offers each supplier makes for a variant (cost and lead time), the purchases recorded from suppliers, the procurement item of each order line that needs buying, and the "Avísame" requests for unavailable variants. [ADR 0007](../adr/0007-availability-mapping.md) decides how offers feed availability and which lines need procurement. [ADR 0008](../adr/0008-regime-flags.md) decides which supplier types the regime allows. The [procurement item state machine](../state-machines/procurement-item.md) is the lifecycle of an item. It does not own variants, stock, reservations or orders: those stay in Medusa. Money follows [ADR 0001](../adr/0001-money-representation.md): `bigNumber` in major units plus a lowercase currency code, and an FX snapshot `{ rate, source, captured_at }` next to every converted amount.

## Models

Medusa adds `created_at`, `updated_at` and `deleted_at` to every data model; soft delete sets `deleted_at` ([Data model properties](https://docs.medusajs.com/learn/fundamentals/data-models/properties)). The tables below leave them out. Every ID uses `model.id({ prefix })` ([id property](https://docs.medusajs.com/resources/references/data-model/property-types/id)). Unique indexes are partial, `where deleted_at` is null ([Indexes](https://docs.medusajs.com/learn/fundamentals/data-models/index)). A `belongsTo` can be optional with `.nullable()` ([Relationships](https://docs.medusajs.com/learn/fundamentals/data-models/relationships)).

The ADRs name the models in PascalCase (`SupplierOffer`). That is the exported constant; the data model name is snake_case (`supplier_offer`), as in the other modules.

### `supplier` (`Supplier`, ID prefix `sup`)

Who the store buys from, and its purchase policy (#28).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `name` | `text` | not blank; unique | Admin label, e.g. "Importador local (demo)" |
| `type` | `enum` | `local_stock`, `local_importer`, `international_marketplace` | ADR 0007, point 9. Labels: "Proveedor local con stock", "Importador local", "Marketplace internacional" |
| `ruc` | `text` | nullable; 11 digits with a valid check digit (service rule, F1 `isValidRuc`); null for `international_marketplace` (check) | Required before the first purchase from a local supplier (service rule) |
| `min_order_amount` | `bigNumber` | nullable; > 0 | Purchase policy: the minimum the supplier accepts |
| `min_order_currency_code` | `text` | nullable; lowercase; set with `min_order_amount` (check) | |
| `max_wait_days` | `number` | nullable; ≥ 1 | Purchase policy: buy even below the minimum after this many calendar days (#28 "48h" is 2) (proposed) |
| `policy_notes` | `text` | nullable; not blank | Cut-off dates and anything else the owner tracks by hand (proposed) |
| `active` | `boolean` | default `true` | Inactive suppliers get no new offers or purchases |
| `offers` | `hasMany(supplier_offer)` | | |
| `purchases` | `hasMany(supplier_purchase)` | | |
| `items` | `hasMany(procurement_item)` | | |

### `supplier_offer` (`SupplierOffer`, ID prefix `supoff`)

The terms under which one supplier sells one variant (ADR 0007, point 3). One variant has many offers, through a module link.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `supplier` | `belongsTo(supplier)` | required | |
| `supplier_reference` | `text` | nullable; not blank | The supplier's SKU or product URL (proposed) |
| `unit_cost` | `bigNumber` | nullable; > 0 | Unknown costs stay null instead of a guess (proposed) |
| `currency_code` | `text` | nullable; lowercase; set with `unit_cost` (check) | `pen`, or `usd` for marketplaces |
| `lead_time_min_days` | `number` | ≥ 1 | Business days, Lima |
| `lead_time_max_days` | `number` | ≥ `lead_time_min_days` (check) | Business days, Lima |
| `priority` | `number` | ≥ 0 | Lower first. Ties: shorter `lead_time_max_days`, then older `created_at` (proposed) |
| `active` | `boolean` | default `true` | Inactive offers never feed availability |
| `items` | `hasMany(procurement_item)` | | |

An offer's variant never changes (service rule). The availability function takes the first active offer, by `priority`, whose supplier is active and allowed by the regime.

### `supplier_purchase` (`SupplierPurchase`, ID prefix `suppur`)

One purchase recorded from a supplier, with its comprobante. Purchases without items (packaging) are allowed, so they count toward the Nuevo RUS cap (ADR 0008).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `supplier` | `belongsTo(supplier)` | required; type allowed by the current regime (service rule) | |
| `comprobante_type` | `enum` | `factura`, `boleta`, `foreign_invoice` (proposed) | `foreign_invoice` for marketplace orders |
| `comprobante_reference` | `text` | not blank; check `^[A-Z0-9]{4}-\d{1,8}$` unless `foreign_invoice`; unique per supplier and type | Series and number, e.g. "F001-1234" |
| `issue_date` | `text` | check `^\d{4}-\d{2}-\d{2}$` | Lima date of the comprobante. The cap counts by it |
| `currency_code` | `text` | lowercase | Currency of every amount below |
| `goods_total` | `bigNumber` | ≥ 0; ≥ the goods cost of its items (service rule) | |
| `freight_total` | `bigNumber` | ≥ 0; default 0 | |
| `duties_total` | `bigNumber` | ≥ 0; default 0 | |
| `importer_fee_total` | `bigNumber` | ≥ 0; default 0 | |
| `total` | `bigNumber` | = the four amounts above (check) | The comprobante total, freight and fees included |
| `fx_rate` | `bigNumber` | > 0; set when `currency_code` is not `pen`, else null (check) | Soles per unit of the purchase currency. Never rewritten once set |
| `fx_source` | `text` | not blank; set with `fx_rate` (check) | Which published rate, e.g. `sbs_venta` (proposed) |
| `fx_captured_at` | `dateTime` | set with `fx_rate` (check) | |
| `failed_at` | `dateTime` | nullable; set once | The supplier cannot deliver |
| `failure_reason` | `text` | nullable; not blank; set with `failed_at` (check) | |
| `supplier_credit_reference` | `text` | nullable; not blank | Refund or credit note received from the supplier |
| `supplier_credit_amount` | `bigNumber` | nullable; > 0; ≤ `total`; set with the reference (check) | In `currency_code` |
| `recorded_by` | `text` | | Admin user ID, `req.auth_context.actor_id` (proposed) |
| `items` | `hasMany(procurement_item)` | | |

Freight, duty and fee amounts can grow when a later invoice arrives. Each change recomputes the landed cost of the items that are not received yet.

### `procurement_item` (`ProcurementItem`, ID prefix `procitem`)

The purchase of one order line the store cannot serve from stock. Created at `order.placed`; one per order line (ADR 0007, point 8).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `status` | `enum` | `pending`, `purchased`, `in_transit`, `received`, `canceled`; default `pending` | Stored (proposed). Labels (admin): "Por comprar", "Comprado", "En tránsito", "Recibido", "Cancelado" |
| `line_item_id` | `text` | unique | Medusa order line item. A retried `order.placed` creates nothing new (proposed) |
| `supplier_offer` | `belongsTo(supplier_offer)` | required | The offer whose promise was copied |
| `supplier` | `belongsTo(supplier)` | required | Copied from the offer |
| `purchase` | `belongsTo(supplier_purchase)` | nullable | Set at `purchased`; cleared when the purchase fails |
| `quantity` | `number` | ≥ 1 | `min(line quantity, shortfall)` |
| `lead_time_min_days` | `number` | ≥ 1 | Copied from the offer; never changes |
| `lead_time_max_days` | `number` | ≥ `lead_time_min_days` (check) | Copied from the offer; never changes |
| `expected_by` | `text` | check `^\d{4}-\d{2}-\d{2}$` | Lima date: order `created_at` plus `lead_time_max_days` business days |
| `expected_unit_cost` | `bigNumber` | nullable; > 0 | Copied from the offer. Feeds committed purchases (ADR 0008) (proposed) |
| `expected_cost_currency_code` | `text` | nullable; set with `expected_unit_cost` (check) | |
| `purchase_unit_price` | `bigNumber` | nullable; > 0; set from `purchased` on (service rule) | Price on the supplier's comprobante |
| `purchase_currency_code` | `text` | nullable; equals the purchase's `currency_code` (service rule) | |
| `landed_unit_cost` | `bigNumber` | nullable; > 0 | Price plus its share of freight, duties and importer fee, split by goods cost, in soles |
| `landed_cost_currency_code` | `text` | nullable; `pen`; set with `landed_unit_cost` (check) | Converted with the purchase's `fx_rate` |
| `dispatched_at` | `dateTime` | nullable | Set at `in_transit` |
| `tracking_reference` | `text` | nullable; not blank | The supplier's tracking reference |
| `received_at` | `dateTime` | nullable | When the goods entered stock. Also set on a `canceled` item whose goods arrived after the cancel |
| `canceled_at` | `dateTime` | nullable | |
| `cancel_reason` | `enum` | nullable; `order_canceled`; set with `canceled_at` (check) | The only reason in the MVP |
| `max_wait_notified_at` | `dateTime` | nullable; set once | `procurement-item.max-wait-reached` goes out once (proposed) |
| `overdue_notified_at` | `dateTime` | nullable; set once | `procurement-item.overdue` goes out once |

Status checks, one per state:

| Status | Requires |
|---|---|
| `pending` | `purchase`, `dispatched_at`, `received_at` and `canceled_at` null |
| `purchased` | `purchase` set; `dispatched_at` null |
| `in_transit` | `purchase` and `dispatched_at` set |
| `received` | `purchase` and `received_at` set |
| `canceled` | `canceled_at` and `cancel_reason` set |

The landed cost is informative, so it is never charged. It keeps the exact big number; displays round half-up to two decimals (ADR 0001, decision 5).

### `restock_request` (`RestockRequest`, ID prefix `rstreq`)

One "Avísame" request: an email waiting for an unavailable variant (ADR 0007, point 4). One variant has many requests, through a module link.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `email` | `text` | trimmed and lowercase; at most 254 characters | F1 `notify-me-form.tsx` |
| `notified_at` | `dateTime` | nullable; set once | When the arrival email went out (notifications work, R10) |

One open request per variant and email (workflow rule): a repeat answers like a new one and stores nothing. The answer never reveals whether the email was already there.

## Module links

Links use `defineLink` ([Module links](https://docs.medusajs.com/learn/fundamentals/module-links)). `isList: true` on one side makes the link one-to-many (same page).

| Link | Other side | Cardinality | Options | Why |
|---|---|---|---|---|
| `product_variant` ↔ `supplier_offer` | Product Module, product variant | one-to-many (`isList` on the offer side) | none (proposed: no cascade) | ADR 0007, point 3. Offers stay with their items' history when a variant is deleted |
| `product_variant` ↔ `restock_request` | Product Module, product variant | one-to-many (`isList` on the request side) | none (proposed) | ADR 0007, point 4. The count per variant is the demand signal (R9) |
| `order` ↔ `procurement_item` | Order Module, order | one-to-many (`isList` on the item side) | none | The order status projection reads the items with the order ([ADR 0003](../adr/0003-order-status-projection.md)) |

Medusa's wishlist guide uses `ProductModule.linkable.productVariant` ([Wishlist plugin](https://docs.medusajs.com/resources/plugins/guides/wishlist)). The key for orders is not verified; F3 spike.

## Service operations

The port other code calls. Generated CRUD methods follow the service factory names ([list method](https://docs.medusajs.com/resources/service-factory-reference/methods/list)). The module reads regime flags from its options, loaded from `src/config/regime.ts` (proposed). Workflows join it with Medusa: a module cannot call another module ([Module isolation](https://docs.medusajs.com/learn/fundamentals/modules/isolation)).

- `eligibleOffer(offers)`: the first active offer by `priority` from an active supplier the regime allows, or null. Pure; `variantAvailability` (ADR 0007) calls it with the offers it read through the link.
- `openQuantityByOffer(offerIds)`: quantity of items neither `received` nor `canceled`, per offer. The shortfall step of ADR 0007, point 8 sums it per variant.
- `createItems(lines)`: one item per `line_item_id`; existing ones are returned unchanged. Copies the offer's promise and computes `expected_by`.
- `recordPurchase(input)`: the supplier is active and allowed; a local supplier has a RUC; the FX snapshot is present when the currency is not `pen`; every item is `pending`. Links the items, sets their prices and landed costs, moves them to `purchased`.
- `updatePurchaseCosts(purchaseId, costs)`: new freight, duties or fee; recomputes landed costs of items not yet received. Never touches the FX snapshot.
- `recordDispatch(itemIds, { dispatched_at, tracking_reference })`: `purchased` → `in_transit`.
- `receiveItems(itemIds, received_at)`: `purchased` or `in_transit` → `received`, whole quantity only.
- `failPurchase(purchaseId, reason)`: sets `failed_at`; its open items go back to `pending` and lose `purchase`, prices and landed cost.
- `cancelItems(itemIds, reason)`: items not received → `canceled`.
- `recordArrivalAfterCancel(itemIds, received_at)`: goods of `canceled` items arrived; sets `received_at`, status stays `canceled`.
- `itemsDueForAlerts(today)`: items past `max_wait_days` or `expected_by` whose flag is still null. Feeds the daily job `procurement-deadlines`.
- `purchaseTotals(from, to)`: purchases by `issue_date`, each with `total`, `currency_code` and `fx_rate`. Feeds the Nuevo RUS cap (see [sunat-billing](sunat-billing.md)).
- `createRestockRequest(email)` and `restockDemand(variantRequestIds)`: the store route and the admin demand list.

Inventory moves (`incoming_quantity`, `stocked_quantity`) belong to the workflows that call these operations, through Medusa's Inventory Module, as the state machine's side effects list.

### Routes that need this module (proposed; T8 fixes the names)

| Route | Purpose |
|---|---|
| `GET /store/variant-availability` | Status, lead time and `max_quantity` per variant (ADR 0007, point 6) |
| `POST /store/restock-requests` | "Avísame". Only `unavailable` variants; throttled |
| `GET`, `POST /admin/suppliers`, `POST /admin/suppliers/:id` | Supplier list and editor |
| `GET`, `POST /admin/supplier-offers`, `POST /admin/supplier-offers/:id` | Offers per variant |
| `GET /admin/procurement-items` | The purchase queue: `pending` first, by `expected_by` |
| `POST /admin/supplier-purchases` | Record a purchase with its items |
| `POST /admin/supplier-purchases/:id/costs` | Later freight, duty or fee invoice |
| `POST /admin/supplier-purchases/:id/fail` | Purchase failed |
| `POST /admin/procurement-items/dispatch`, `POST /admin/procurement-items/receive` | Dispatch and reception |
| `GET /admin/restock-requests` | Demand per variant |

## Events

- Emitted, by the workflows with `emitEventStep` after they succeed ([Emit event](https://docs.medusajs.com/learn/fundamentals/events-and-subscribers/emit-event)): `procurement-item.created`, `procurement-item.purchased`, `procurement-item.dispatched`, `procurement-item.received`, `procurement-item.purchase-failed`, `procurement-item.canceled`, `procurement-item.max-wait-reached`, `procurement-item.overdue`. Payload `{ id }` (proposed).
- Consumed: `order.placed` (`createProcurementItemsWorkflow`) and `order.canceled` (`cancelProcurementItemsWorkflow`), payload `{ id }` ([Events reference](https://docs.medusajs.com/resources/references/events)).

## Seed and data sources

- Supplier: one `local_importer` named "Importador local (demo)", without RUC (proposed). The owner replaces it with real suppliers before launch.
- Offers: one per variant whose F1 availability is `BACKORDER` (`src/modules/catalog/infrastructure/fixtures/helpers.ts`, used in `chargers.ts` and `hubs-and-docks.ts`): 15 to 20 business days, priority 0, active, no cost (F1 has none). Each linked to its variant with `link.create`.
- Those variants get `allow_backorder` on and no stock (ADR 0007, seed follow-up).
- The Apple line gets no offers (ADR 0007, point 4).
- No purchases, items or restock requests.
- Order: products and variants first (Medusa), then the supplier, offers and links (Engram #121, seed order).

## Open items

- Proposed: a stored `status` on items. Alternative: derive it from timestamps, as orders do (ADR 0003). Not chosen: `purchased` → `pending` clears the purchase link, so the facts alone cannot tell a failed purchase from a new item.
- Proposed: `line_item_id` as a plain ID with a unique index. Alternative: a link `order_line_item` ↔ `procurement_item`; whether order line items are linkable is not verified.
- Proposed: a failed purchase loses its items (the state machine unlinks them). Alternative: keep the failed purchase's ID on the item, to list what each failed purchase held.
- Proposed: `unit_cost` nullable, so the seed invents no costs. Alternative: required cost, with DRAFT placeholders in the seed.
- Proposed: `max_wait_days` in calendar days, checked by the daily job. Cut-off dates are free text in `policy_notes`. Alternative: a `supplier_cutoff` model with dates, if importers publish fixed cut-offs.
- Accountant question: which exchange rate to use for purchases in dollars (`fx_source`).
- Accountant question: which purchase comprobantes count for the Nuevo RUS cap, and whether a supplier credit note reduces the month's purchases (ADR 0008).
- Proposed: restock requests are kept until notified. Retention afterwards is not decided; the privacy policy and the ANPD registration cover the email (R10).
- F3 spike: whether Medusa uses `incoming_quantity` in its own stock checks (state machine).
- F3 spike: the linkable key for orders.
- F3 spike: whether a fulfillment can be created while `stocked_quantity` is below the reserved quantity (state machine).
