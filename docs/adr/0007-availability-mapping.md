# ADR 0007 — Availability: Medusa inventory plus procurement offers, enforced on the server

- Status: Proposed — pending owner review
- Date: 2026-11-04
- Deciders: Owner
- Related: Engram #107 (section 3, catalog and cart), #118 (R8, R9), #121, #28, #30, #18 (6.3); [ADR 0001](0001-money-representation.md), [ADR 0003](0003-order-status-projection.md), [ADR 0008](0008-regime-flags.md); [procurement item state machine](../state-machines/procurement-item.md)

## Context

- **F1 statuses.** Each variant has one availability: `in_stock`, `backorder { leadTimeDays { min, max } }` or `unavailable` (`catalog/domain/availability.ts`). Lead times are business days. The fixtures use one lead time: every backorder is 15–20 days. Only the Apple line is `unavailable`.
- **F1 labels.** "En stock", "En importación · llega en 15–20 días" and "Agotado".
- **F1 "Avísame".** `in_stock` and `backorder` can be bought. `unavailable` shows "Avísame cuando llegue". The form validates an email and confirms on screen: "Listo. Te escribiremos a {correo} cuando {producto} llegue a la tienda." Nothing is sent or stored (`catalog/ui/notify-me-form.tsx`).
- **F1 quantity limits.** `MAX_LINE_QUANTITY = { in_stock: 5, backorder: 2 }` in `cart/domain/cart.ts:14`, duplicated as `MAX_QUANTITY` in `catalog/ui/product-page.view.ts`. The cart keeps one line per SKU. A request above the limit is lowered to the limit (clamp). A known smaller stock lowers the limit further. Only the storefront enforces the limits (R8).
- **Medusa inventory.**
  - A variant with `manage_inventory` disabled is "always" considered in stock. With it enabled, Medusa links an inventory item with one inventory level per stock location. `allow_backorder` "allows customers to purchase the product variant even when it's out of stock" ([Product Variant Inventory](https://docs.medusajs.com/resources/commerce-modules/product/variant-inventory)).
  - Inventory operations are scoped by the sales channel and its stock locations. The publishable API key sets the sales channel ([same page](https://docs.medusajs.com/resources/commerce-modules/product/variant-inventory); [Sales Channel links](https://docs.medusajs.com/resources/commerce-modules/sales-channel/links-to-other-modules)). The storefront reads `inventory_quantity` with `fields=+variants.inventory_quantity` ([Retrieve Product Variant's Inventory](https://docs.medusajs.com/resources/storefront-development/products/inventory)).
  - An inventory level has `stocked_quantity`, `reserved_quantity` and `incoming_quantity` ([Inventory concepts](https://docs.medusajs.com/resources/commerce-modules/inventory/concepts)).
  - Adding to the cart runs `confirmVariantInventoryWorkflow`. It throws when stock is short, except for a variant with `allow_backorder` ([addToCartWorkflow](https://docs.medusajs.com/resources/references/medusa-workflows/addToCartWorkflow); [confirmInventoryStep](https://docs.medusajs.com/resources/references/medusa-workflows/steps/confirmInventoryStep)). `completeCartWorkflow` reserves the inventory of each line ([completeCartWorkflow](https://docs.medusajs.com/resources/references/medusa-workflows/completeCartWorkflow)).
  - Since v2.19.0, `addToCartWorkflow` and `createCartWorkflow` accept `allow_backorder` on each item. It bypasses the stock check ([Product Variant Inventory](https://docs.medusajs.com/resources/commerce-modules/product/variant-inventory)). Whether the store route accepts it from the storefront: Not verified; F3 spike.
  - `addToCartWorkflow` runs `validateLineItemPricesStep`, which checks that line items have prices.
- **Medusa cart hooks.** All three workflows expose a `validate` hook that runs before any change:

  | Workflow | Hook input | Source |
  |---|---|---|
  | `addToCartWorkflow` | `input { cart_id, items, additional_data }`, `cart` | [reference](https://docs.medusajs.com/resources/references/medusa-workflows/addToCartWorkflow) |
  | `updateLineItemInCartWorkflow` | `input { cart_id, item_id, update, additional_data }`, `cart` | [reference](https://docs.medusajs.com/resources/references/medusa-workflows/updateLineItemInCartWorkflow) |
  | `completeCartWorkflow` | `input { id }`, `cart` | [reference](https://docs.medusajs.com/resources/references/medusa-workflows/completeCartWorkflow) |

  - "If the hook throws an error, the add-to-cart operation will be aborted and the error message will be returned to the client" ([Ticket booking example](https://docs.medusajs.com/resources/recipes/ticket-booking/example)). `cart` is typed `any`; that example reads the cart's items with a query by `cart_id`.
  - Adding a variant already in the cart updates its line. "The same product variant added with different `metadata` to the cart is treated as a separate line item" ([Personalized products example](https://docs.medusajs.com/resources/recipes/personalized-products/example)).
  - `MedusaError` types `NOT_ALLOWED` and `INVALID_DATA` answer HTTP 400. A third constructor argument sets a `code` in the response ([Throwing and Handling Errors](https://docs.medusajs.com/learn/fundamentals/api-routes/errors)).
- **Medusa pattern.** The pre-order tutorial keeps per-variant configuration in a custom module model linked to `ProductVariant` ([Pre-orders tutorial](https://docs.medusajs.com/resources/how-to-tutorials/tutorials/preorder)).
- **Nuevo RUS.** A taxpayer that operates in more than one "unidad de explotación", which includes a "depósito o almacén", cannot be in the regime (D. Leg. 937, art. 3.1 b). Customs operations are excluded (art. 3.2 c) ([Nuevo RUS text, SUNAT](https://www.sunat.gob.pe/legislacion/rus/rus.pdf)).

## Decision

1. **Availability is computed, never stored** (proposed). One pure function, `variantAvailability`, returns `{ status, lead_time_days, max_quantity }` for a variant. It reads the variant, its inventory level at the store's stock location, its supplier offers and the regime settings ([ADR 0008](0008-regime-flags.md)). It lives in backend application code outside any module, like the order status projection ([ADR 0003](0003-order-status-projection.md)). The availability route and the three cart hooks call the same function.
2. **Mapping** (proposed). `available` is `stocked_quantity − reserved_quantity` at the store's stock location. The first row that holds sets the status:

   | # | Condition | Status | `max_quantity` |
   |---|---|---|---|
   | 1 | The product is in the Apple line and `apple_line_purchasable` is off | `unavailable` | 0 |
   | 2 | `manage_inventory` is off (configuration error, logged) | `unavailable` | 0 |
   | 3 | `available > 0` | `in_stock` | `min(5, available)` |
   | 4 | `allow_backorder` is on and the variant has an active offer from a supplier the regime allows | `backorder` | 2 |
   | 5 | Otherwise | `unavailable` | 0 |

   - Every sellable variant has `manage_inventory` on. Off would make Medusa sell it as always in stock.
   - There is one stock location, linked to the storefront's sales channel. Under Nuevo RUS, a second warehouse would be a second "unidad de explotación". The accountant confirms how the regime counts the owner's storage.
   - A line is never part stock, part backorder. While stock exists, the variant sells as `in_stock` up to that stock. It becomes `backorder` only at zero.
   - To sell on order, the owner turns on `allow_backorder` and keeps an active supplier offer. Turning `allow_backorder` off stops backorders at once.
3. **Lead time lives in the procurement module** (proposed). A `SupplierOffer` holds the terms under which one supplier sells one variant: supplier, `lead_time_min_days`, `lead_time_max_days` (business days, Lima), unit cost with `currency_code`, `priority` and `active`. A module link connects `ProductVariant` to its offers, as a list ([Module links](https://docs.medusajs.com/learn/fundamentals/module-links)). T7 defines the fields. The shown lead time comes from the first active offer, by `priority`, among suppliers the regime allows. Lead time is never stored in metadata (#18, 6.3). The procurement item copies it when the order is placed, so later offer changes do not change a promise.
4. **"Avísame" and the Apple line.**
   - The Apple line stays "Avísame", not purchasable, until regime B (approved, R9).
   - The Apple products belong to the product collection with handle `linea-apple` (proposed). Row 1 makes them `unavailable` whatever their stock, offers or prices. The seed plan (T9) creates the collection.
   - Their data also stays unsellable (proposed): no PEN price, no stock, no offers, `allow_backorder` off. That gives three independent barriers: row 1, Medusa's price check and Medusa's stock check. The F1 fixtures show Peru reference prices; R9 removes them.
   - "Avísame" stores the request (proposed). A custom route `POST /store/restock-requests` saves `{ variant, email }` as a `RestockRequest` in the procurement module, linked to the variant. It accepts only variants whose status is `unavailable`, and it is throttled. The count per variant is the demand signal R9 asks for. Sending the email when the product arrives belongs to the notifications work (Resend, R10). The email is personal data: the privacy policy and the ANPD registration cover it (R10).
5. **Quantity limits on the server.**
   - Limits are enforced server-side: 5 per line in stock, 2 per line on backorder. The duplicated constants are unified (approved, R8). The backend owns the numbers. The storefront receives `max_quantity` and drops both constants.
   - Each `validate` hook reads the cart's lines with a query by cart ID. It does not rely on the untyped `cart` input (proposed).
   - The check sums all lines of the same variant, because lines with different metadata are not merged (proposed):

     | Hook | Quantity checked per variant |
     |---|---|
     | `addToCartWorkflow` | Quantity already in the cart plus every incoming item of that variant |
     | `updateLineItemInCartWorkflow` | New quantity of `item_id` plus the other lines of that variant |
     | `completeCartWorkflow` | Every line of that variant |

   - The hook throws `NOT_ALLOWED` with a code when the sum is above `max_quantity` (`quantity_limit`) or the status is `unavailable` (`variant_unavailable`) (proposed). The storefront maps each code to its F1 copy.
   - The server rejects; it never lowers a quantity silently (proposed). The storefront keeps the F1 clamp before it sends the request.
   - The add-to-cart hook rejects an item that carries `allow_backorder` (`backorder_override_not_allowed`), whatever F3 finds about the store route (proposed).
   - The hooks reject a quantity that is not a positive integer (proposed). A fractional quantity reaching the cart is an open upstream report (medusajs/medusa issue #16802); the docs do not cover it. Not verified; F3 spike.
6. **What the storefront receives** (proposed).
   - Product data and prices come from the standard store product routes (`fields=*variants.calculated_price`, Engram #121).
   - Availability comes from a custom route, `GET /store/variant-availability?variant_id=…`. It answers `[{ variant_id, status, lead_time_days: { min, max } | null, max_quantity }]`. T8 places it in the contract map.
   - The storefront never requests `inventory_quantity`. `max_quantity` reveals at most 5 units.
7. **Availability is checked again at checkout** (proposed).
   - `completeCartWorkflow`'s `validate` hook recomputes every line before the order is created and the payment authorized.
   - Medusa then reserves the inventory.
   - The storefront re-reads availability on the payment step and stops when a status or a limit changed since the review (F4).
8. **Which lines need procurement** (proposed). The procurement items are created when the order is placed, by a subscriber on `order.placed` (approved). The workflow takes a lock per variant. It computes the variant's shortfall at the store location: reserved quantity, minus stocked quantity, minus the quantity of open procurement items. Each line of the order gets one procurement item for `min(line quantity, shortfall)` when that is above zero. The [procurement item state machine](../state-machines/procurement-item.md) takes over from there.
9. **Supplier types by regime.** Only local purchases are compatible with Nuevo RUS (approved, #28). Marketplace suppliers are gated by the regime flag (approved, #30):

   | Supplier type | Nuevo RUS | Regime B |
   |---|---|---|
   | `local_stock`: local supplier with stock, sells with a comprobante | Allowed | Allowed |
   | `local_importer`: the legal importer of the goods, sells with a comprobante | Allowed | Allowed |
   | `international_marketplace`: official stores on AliExpress or Temu, direct import | Not allowed: a customs operation | Allowed when `marketplace_suppliers` is on |

   - Rows 3–4 of the mapping ignore offers from suppliers the regime does not allow (proposed).
   - Recording a purchase from such a supplier is rejected (proposed).
   - An import where the customs declaration (DAM) names the owner is not a supplier type: it makes the owner the importer (#28).

## Consequences

- What the storefront shows and what the server accepts come from one function. The storefront cannot offer a quantity or a status that checkout rejects.
- Required tests: one per mapping row; the Apple line with stock present; the sum across lines with different metadata; update and completion after stock changes; `allow_backorder` on an item; a fractional quantity; two orders taking the last unit at once.
- **Residual race.** If the last unit sells between the payment-step check and completion, a line of 1–2 units completes as a backorder. The order shows `en_importacion` and the confirmation email states the lead time. The customer may cancel with a full refund (ADR 0003). At expected volume this is rare and accepted.
- **Shortfall assignment.** Two orders placed within seconds for the last unit get the right total of procurement. The item may attach to the order that was processed first rather than the one placed later. Whether Medusa reservations expose their line item, which would make the assignment exact: Not verified; F3 spike.
- Medusa's own stock check still runs. A variant with `allow_backorder` off and no stock fails twice: in the hook and in `confirmVariantInventoryWorkflow`.
- Copy follow-ups for the owner (F4):
  - "En importación" is inaccurate when a local supplier serves the backorder.
  - "Agotado" is inaccurate for the Apple line, which is not sold yet.
- Storefront follow-up (F4):
  - Remove `MAX_LINE_QUANTITY` and `MAX_QUANTITY`; read `max_quantity`.
  - Map the error codes to the F1 copy.
  - Post "Avísame" to the new route.
  - Show no price for the Apple line.
- Data model follow-up (T7): `Supplier`, `SupplierOffer` and `RestockRequest`, and their links to `ProductVariant`.
- Seed follow-up (T9):
  - `manage_inventory` on for every variant.
  - Backorder fixtures get `allow_backorder` on, no stock, and an offer of 15–20 days from a local supplier.
  - One stock location linked to the storefront sales channel.
  - The `linea-apple` collection.

## Alternatives considered

- **The storefront derives availability from raw Medusa fields.** It would read `manage_inventory`, `allow_backorder`, `inventory_quantity` and linked offer fields. Rejected: the rules would live in two apps, and the regime gate would be invisible to the storefront. Whether store routes return linked custom fields is not verified.
- **Lead time in variant metadata.** Rejected: no business data in metadata (#18). It would also have no validation, no history and no supplier.
- **`manage_inventory` off for backorder variants.** Rejected: Medusa would treat them as always in stock, with no stock count and no reservation.
- **The server clamps quantities.** Rejected: the quantity would change at payment without the customer seeing it.
- **Allow lines that are part stock, part backorder.** Rejected: one line would carry two promises and two limits, and F1 has no way to show it.
- **Mark the Apple line with a boolean on a custom model linked to the product.** Rejected: a model and a link for one rule. A collection is core data, visible in the admin. Tradeoff: if a product belongs to only one collection, the Apple products cannot join another collection. Not verified; F3 spike.
- **Remove the Apple prices as the only barrier.** Rejected: one mistaken price in the admin would make a MacBook purchasable under Nuevo RUS.
- **Keep "Avísame" as a screen-only confirmation.** Rejected: production copy would promise an email that never comes, and the demand signal would be lost.
