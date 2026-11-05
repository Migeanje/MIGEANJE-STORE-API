# Data model

The custom Medusa modules of the Migeanje Store backend, their models and the module links that connect them to Medusa's own models. Each module has its own page; this page is the map. Status: proposed, pending owner review, except where an accepted ADR already decided it.

## Conventions

- Models use Medusa's data model language (DML). Relationships stay inside one module; anything across modules is a module link (`defineLink`) ([Module links](https://docs.medusajs.com/learn/fundamentals/module-links)).
- IDs use `model.id({ prefix })` with a short prefix that is unique across all modules.
- Money is `bigNumber` in major units plus a lowercase `currency_code` ([ADR 0001](../adr/0001-money-representation.md)). Exchange rates are stored as a snapshot `{ rate, source, captured_at }`.
- No business data in `metadata` (Engram #18).
- Medusa adds `created_at`, `updated_at` and `deleted_at` to every model. Timestamps are UTC; screens show them in America/Lima.
- Since v2.18.0, `query.graph` can filter by the fields of a linked model, with caveats: some cases fall back to filtering in memory, which ignores pagination ([Query linked records](https://docs.medusajs.com/learn/fundamentals/module-links/query)). Routes that filter by linked data say so and are load-tested in F3.

## Medusa models used as they are

| Storefront concept | Medusa model | Notes |
|---|---|---|
| Brand | Product collection | One collection per brand; `handle` is the F1 brand slug, `title` its name (proposed). A product belongs to at most one collection ([Product model](https://docs.medusajs.com/resources/references/product/models/Product)), as a product has one brand. The Apple line is the `apple` collection ([ADR 0007](../adr/0007-availability-mapping.md)). |
| Category | Product category | The 9 F1 categories. |
| Product, variant, price | Product, product variant, price set | Prices in `pen`, tax-inclusive ([ADR 0008](../adr/0008-regime-flags.md)). |
| Stock | Inventory item, inventory level, stock location | One stock location linked to the storefront sales channel ([ADR 0007](../adr/0007-availability-mapping.md)). |
| Customer, address | Customer, customer address | Auth in [ADR 0004](../adr/0004-customer-auth.md). |
| Cart, order, payment, fulfillment | Cart, order, payment, fulfillment | Order number in [ADR 0002](../adr/0002-order-number.md), status in [ADR 0003](../adr/0003-order-status-projection.md). |
| Shipping zones and rates | Service zones, province geo zones, flat shipping options | See [ubigeo-shipping](ubigeo-shipping.md). |

## Modules

| Module | Page | Owns |
|---|---|---|
| specs | [specs.md](specs.md) | Spec schemas per category and the spec values of each product |
| editorial | [editorial.md](editorial.md) | Review rubrics per category and the expert review of each product |
| ubigeo-shipping | [ubigeo-shipping.md](ubigeo-shipping.md) | The ubigeo tree, transit times, holidays and the delivery estimate of each order |
| procurement | [procurement.md](procurement.md) | Suppliers, supplier offers, supplier purchases, procurement items and "Avísame" requests |
| sunat-billing | [sunat-billing.md](sunat-billing.md) | The receipt requested at checkout, the comprobantes of each order and the Nuevo RUS cap alerts |
| culqi | [culqi.md](culqi.md) | Reconciliation records of Culqi charges. The `culqi-payment` provider has no models |
| complaints | [complaints.md](complaints.md) | Complaint sheets, their answers and the yearly counter |
| — | [customer-favorites.md](customer-favorites.md) | Favorites: a link between customer and product, with no module of its own |

## Module links

| Link | Sides | Cardinality | Options |
|---|---|---|---|
| Specs of a category | `product_category` ↔ `spec_schema` | one-to-one | none |
| Specs of a product | `product` ↔ `product_spec_sheet` | one-to-one | `deleteCascade` |
| Rubric of a category | `product_category` ↔ `review_rubric` | one-to-one | none |
| Review of a product | `product` ↔ `expert_review` | one-to-one | `deleteCascade` |
| Transit time of a shipping option | `shipping_option` ↔ `transit_time` | one-to-one | none |
| Delivery estimate of an order | `order` ↔ `delivery_estimate` | one-to-one | none |
| Offers of a variant | `product_variant` ↔ `supplier_offer` | one-to-many (`isList` on the offer) | none |
| "Avísame" requests of a variant | `product_variant` ↔ `restock_request` | one-to-many (`isList` on the request) | none |
| Procurement items of an order | `order` ↔ `procurement_item` | one-to-many (`isList` on the item) | none |
| Receipt requested for a cart | `cart` ↔ `receipt_request` | one-to-one | none |
| Comprobantes of an order | `order` ↔ `comprobante` | one-to-many (`isList` on the comprobante) | none |
| Favorites | `customer` ↔ `product` | many-to-many (`isList` on both) | extra column `favorited_at`; no `deleteCascade` |

Not verified: whether a link between two Medusa commerce modules (customer ↔ product) is supported. The fallback is a small `customer_favorite` model with read-only links, as in Medusa's wishlist guide ([customer favorites](customer-favorites.md)). F3 spike.

## Models

| Model | ID prefix | Module |
|---|---|---|
| `spec_schema` | `specsch` | specs |
| `spec_definition` | `specdef` | specs |
| `product_spec_sheet` | `specsheet` | specs |
| `spec_value` | `specval` | specs |
| `review_rubric` | `rvrub` | editorial |
| `rubric_criterion` | `rvcrit` | editorial |
| `expert_review` | `exrev` | editorial |
| `rubric_score` | `rvscore` | editorial |
| `ubigeo_departamento` | `ubidep` | ubigeo-shipping |
| `ubigeo_provincia` | `ubiprov` | ubigeo-shipping |
| `ubigeo_distrito` | `ubidist` | ubigeo-shipping |
| `transit_time` | `trtime` | ubigeo-shipping |
| `holiday` | `hday` | ubigeo-shipping |
| `delivery_estimate` | `dlvest` | ubigeo-shipping |
| `supplier` | `sup` | procurement |
| `supplier_offer` | `supoff` | procurement |
| `supplier_purchase` | `suppur` | procurement |
| `procurement_item` | `procitem` | procurement |
| `restock_request` | `rstreq` | procurement |
| `receipt_request` | `rcptreq` | sunat-billing |
| `comprobante` | `cpe` | sunat-billing |
| `nrus_cap_alert` | `nrusalert` | sunat-billing |
| `culqi_reconciliation` | `culrec` | culqi |
| `complaint` | `cmpl` | complaints |
| `complaint_answer` | `cmplans` | complaints |
| `complaint_counter` | `cmplctr` | complaints |
| `customer_favorite` (fallback only) | `custfav` | favorites fallback |
