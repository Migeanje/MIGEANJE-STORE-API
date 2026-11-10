# ADR 0003 — Order status: a projection of order, payment, fulfillment and procurement

- Status: Accepted
- Date: 2026-11-04
- Deciders: Owner
- Related: Engram #107 (section 3, orders), #118 (R5), #121; ADR 0002; [order state machine](../state-machines/order.md)

## Context

- The F1 storefront shows one status per order and a timeline `[{ status, at | null }]`. The statuses run in this order: `pagado` → `en_importacion` (only for orders with backorder lines) → `preparando` → `en_camino` → `entregado`. F1 stamps `pagado`, and `en_importacion` when it applies, when the order is placed. `preparando` and the later statuses come afterwards.
- F1 has no way out of that line. A canceled or refunded order keeps showing its last progress status. R5 adds `cancelado` and `reembolsado`.
- Medusa does not have this status. The facts live in four places:
  - The order: `status`, which includes `canceled`, and `canceled_at`.
  - Payments: the computed `payment_status`, captures and refunds.
  - Fulfillments: each one has `packed_at`, `shipped_at`, `delivered_at` and `canceled_at` ([Fulfillment model](https://docs.medusajs.com/resources/references/fulfillment/models/Fulfillment)). There is also the computed `fulfillment_status`.
  - The procurement module (custom): the purchase of each backorder line from its supplier.
- `cancelOrderWorkflow` fails while the order has a fulfillment that is not canceled. It refunds captured payments and emits `order.canceled`.
- Payments are meant to be captured when the order is placed: ADR 0005 (decision 6) charges with `capture: true`. Whether Medusa records that capture is not verified yet; it is F3 spike S1 of ADR 0005.
  - If S1 holds, **every canceled order that was paid also ends up fully refunded**.
  - If S1 fails, ADR 0005's fallback captures right after placement. An order canceled in between is refunded at Culqi, but Medusa records no refund, so its refund detail line is missing until F3 closes that window (ADR 0005, decision 6).
  - ADR 0005 decision 6 owns capture at placement; this ADR only builds on it. If the owner rejects that decision, decision 3 below (`cancelado` beats `reembolsado`) must be reviewed again.

## Decision

1. **The status is computed, never stored.** One pure function in the backend computes the customer status and the timeline. It reads the order with its payments, fulfillments and linked procurement items in one `query.graph` call. It lives in the backend's order-tracking application code, outside any module, because it reads four modules. The guest tracking route, the account order routes and the order emails all use it. The storefront only maps the result.
2. **Precedence.** The first rule that holds sets the current status:

   | # | Condition | Status |
   |---|---|---|
   | 1 | The order `status` is `canceled` | `cancelado` |
   | 2 | `payment_status` is `refunded`: the refunded total equals the captured total | `reembolsado` |
   | 3 | `fulfillment_status` is `delivered` | `entregado` |
   | 4 | A fulfillment that is not canceled has `shipped_at` | `en_camino` |
   | 5 | A fulfillment that is not canceled exists, and every procurement item that is not canceled is received | `preparando` |
   | 6 | The order has a procurement item that is not canceled, and either one of them is not received yet or no fulfillment that is not canceled exists | `en_importacion` |
   | 7 | Otherwise | `pagado` |

3. **`cancelado` beats `reembolsado`** (owner decision, 2026-11-04). A canceled order shows `cancelado`. Its refund appears as a detail line. `reembolsado` is reserved for a full refund of an order that was **not** canceled. In normal operation that happens after shipment: a return, or an order lost in transit. Before shipment the owner cancels the order instead. Nothing in Medusa prevents a full refund without cancellation at an earlier step, and the projection then shows `reembolsado` too (see the [order state machine](../state-machines/order.md)). Without this rule, `cancelado` would almost never show, because a paid order that is canceled is always refunded.
4. **Partial refunds do not change the status.** `partially_refunded` keeps the progress status, and each refund appears as a detail line.
5. **When each step is reached** (the `at` of the timeline):
   - `pagado`: the order's `created_at`. `completeCartWorkflow` only creates an order whose payment was authorized.
   - `en_importacion`: the order's `created_at`. The step appears only when the order has procurement items. It lasts until a fulfillment exists **and** every item is received, so goods that arrive before the owner creates the fulfillment never send the order back to `pagado` (rule 6).
     - A subscriber on `order.placed` creates the procurement items right after the order. Until it runs, the projection shows `pagado`.
     - If it fails, the order would show `pagado` for good. F3 makes it retry and alerts the owner when it keeps failing.
   - `preparando`: the creation of the first fulfillment that is not canceled. When the order has procurement items, it is the later of that time and the reception of the last item. A fulfillment created before the goods arrive does not end `en_importacion`.
   - `en_camino`: the earliest `shipped_at`.
   - `entregado`: the latest `delivered_at`.
   - `cancelado`: the order's `canceled_at`.
   - `reembolsado`: the creation of the refund that completed the full refund.
6. **Timeline shape.** Progress steps are listed in order, with `at: null` until reached. When the order ends in `cancelado` or `reembolsado`, the progress steps that were never reached are dropped and the final step is appended with its date. Refunds are a separate list `[{ amount: Money, at }]` shown as detail lines.
7. **Customer copy** (neutral Peruvian Spanish):
   - `cancelado`: "Cancelado" — "Cancelamos tu pedido."
   - `reembolsado`: "Reembolsado" — "Te devolvimos el total de tu pago."
   - Refund detail line: "Te devolvimos S/ 248.90 el 5 de noviembre."
8. **Draft orders are not customer orders.** Orders with `is_draft_order` never reach the projection or the customer routes.

## Consequences

- No status column means no status that drifts from reality. Every status change comes from a Medusa workflow or a procurement transition that already exists.
- In-stock orders show `pagado` until the owner creates the fulfillment, as in F1.
- The projection is the most tested piece of order tracking. F3 writes it test-first with one case per precedence row, plus: canceled and refunded, partial refund, full refund before shipment without cancellation (`reembolsado`), fulfillment created before the goods arrive, every item received before the fulfillment exists (stays `en_importacion`), procurement subscriber not run yet (`pagado`), canceled fulfillment, and partial delivery (stays `en_camino`).
- Once an order is shipped, the only way out is a full refund: after a return, or when the carrier lost the order. Canceling an order that is in `preparando` requires canceling its fulfillment first.
- Canceling an order must also cancel its open procurement items. A subscriber on `order.canceled` does it, following the procurement item state machine (T6).
- Storefront follow-up (F4):
  - `ORDER_STATUSES` gains `cancelado` and `reembolsado`.
  - The timeline invariants accept a final step after the reached steps.
  - The order view gains the refunds list.
  - `order-copy.ts` gains the new labels.

## Alternatives considered

- **Store the status in a custom column and update it from subscribers.** Rejected: every missed or reordered event leaves a wrong status, and the facts already live in Medusa.
- **Compute the status in the storefront.** Rejected: the storefront would need procurement data and Medusa internals, and the emails would need a second copy of the rules.
- **`reembolsado` beats `cancelado`.** Rejected by the owner: it hides cancellations.
