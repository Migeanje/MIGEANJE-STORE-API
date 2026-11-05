# ADR 0005 — Payments: Culqi tokenization and a Medusa payment provider

- Status: Proposed — pending owner review
- Date: 2026-11-04
- Deciders: Owner
- Related: Engram #118 (R1, R2, R10), #121, #107 (section 3, checkout and orders), #30; [ADR 0001](0001-money-representation.md); [ADR 0003](0003-order-status-projection.md); [order state machine](../state-machines/order.md)

## Context

**The F1 storefront**

- `PaymentGateway.charge` receives a `PaymentCard` (the simulated test card) and answers `approved` or `declined`. R1 forbids that shape in production: card data never touches our servers.
- `placeOrder` builds the order before charging and charges once.
- When the order cannot be stored after an approved charge, `placeOrder` records a `PendingReconciliation`. The `ReconciliationLog` port has `record` and `findByCart`. A cart with a pending reconciliation is never charged again.
- The payment page posts a `PaymentQuote` `{ total, fingerprint }`. The fingerprint is FNV-1a over each line's SKU, quantity, unit price and availability, plus the shipping zone and cost.
- The fingerprint is not a security measure. It only tells whether the customer saw the same cart.
- R10 leaves "Culqi idempotency (double-charge window)" open for F3 and F4.

**Medusa v2** (official documentation)

- Flow: payment collection → payment session → `POST /store/carts/:id/complete` ([Accept Payment in Checkout Flow](https://docs.medusajs.com/resources/commerce-modules/payment/payment-flow)).
- A provider extends `AbstractPaymentProvider`, lives under `src/modules` and exports `ModuleProvider(Modules.PAYMENT, { services })` ([Payment Module Provider](https://docs.medusajs.com/resources/references/payment/provider)).
- It is registered under `@medusajs/medusa/payment` with an `id` and `options`. Medusa stores it as `pp_{identifier}_{id}`. It must be enabled in a region in the admin (same page).
- Session data "is accessible in the storefront as well". Only data that can be shared publicly goes there ([Payment Session](https://docs.medusajs.com/resources/commerce-modules/payment/payment-session)). The provider reference adds: do not store sensitive data and tokens in `data`.
- Since v2.22.1, `POST /store/payment-collections/{id}/payment-sessions/{session_id}` merges `client_data` into the session's `data.client`. It accepts sessions in `pending`, `requires_more` or `error`. "The rest of the session's `data` is owned by the payment provider." ([Checkout payment step](https://docs.medusajs.com/resources/storefront-development/checkout/payment), [Update Payment Session](https://docs.medusajs.com/api/store/payment-collections/update-payment-session))
- Creating a session runs `deletePaymentSessionsWorkflow` first. Deletion is refused while authorization is pending, or while a payment of the session is not canceled or fully refunded ([createPaymentSessionsWorkflow](https://docs.medusajs.com/resources/references/medusa-workflows/createPaymentSessionsWorkflow)).
- When the cart total changes, the collection's sessions are deleted and its amount is synced ([refreshPaymentCollectionForCartWorkflow](https://docs.medusajs.com/resources/references/medusa-workflows/refreshPaymentCollectionForCartWorkflow)).
- `completeCartWorkflow` ([reference](https://docs.medusajs.com/resources/references/medusa-workflows/completeCartWorkflow)):
  - It is idempotent: the same cart returns the same order. Callers acquire a lock around it.
  - It creates the order first and authorizes the payment session as its last operation.
  - On failure, `compensatePaymentIfNeededStep` cancels an uncaptured payment or refunds a captured one.
  - It does not check that the authorized amount matches the cart total.
  - Its `validate` hook runs before the order is created and the payment is authorized.
- Session statuses: `pending`, `requires_more` ("requires an action before it's authorized"; 3DS is the example), `authorized`, `error`, `canceled`, `pending_authorization`. The Store API enum also lists `captured` ([Initialize Payment Session](https://docs.medusajs.com/api/store/payment-collections/initialize-payment-session)).
- A provider may capture inside `authorizePayment` and return `captured`. The official PayPal guide does it when `autoCapture` is on ([PayPal guide](https://docs.medusajs.com/resources/integrations/guides/paypal)).
- The admin shows "Authorized" after placement "unless the payment provider is configured to automatically capture the payment" ([Order payments](https://docs.medusajs.com/user-guide/orders/payments)).
- `cancelPayment`: "The order can only be canceled if the payment is not captured yet." `refundPayment` receives `amount`, `data` and `context`, and may run several times for one payment (provider reference).
- `refundPaymentWorkflow` takes `amount`, `note` and `refund_reason_id`, and rejects a refund above the captured amount ([refundPaymentWorkflow](https://docs.medusajs.com/resources/references/medusa-workflows/refundPaymentWorkflow)). `RefundReason` has a required `code` ([RefundReason](https://docs.medusajs.com/resources/references/payment/models/RefundReason)).
- Webhooks arrive at `/hooks/payment/{identifier}_{id}`. The prefixed `pp_` form is also accepted since v2.21.2. The route calls `getWebhookActionAndData` ([Payment Webhook Events](https://docs.medusajs.com/resources/commerce-modules/payment/webhook-events)).
- On a webhook action `authorized` or `captured`, Medusa updates the session and completes the cart if it is not completed yet (same page).
- Scheduled jobs live in `src/jobs` and export a `name` and a cron `schedule` ([Scheduled Jobs](https://docs.medusajs.com/learn/fundamentals/scheduled-jobs)).

**Culqi** (official documentation; the API spec is [apiculqi.yaml](https://apidocs.culqi.com/apiculqi.yaml))

- `pk_` keys "solo tienen el poder de crear tokens" and may be published in front-end code. `sk_` keys can make any request and stay on servers. Test keys are `pk_test_`/`sk_test_`; live keys are `pk_live_`/`sk_live_` ([Llaves](https://docs.culqi.com/es/documentacion/pagos-online/llaves)).
- The Custom Checkout (`https://js.culqi.com/checkout-js`, `new CulqiCheckout(publicKey, config)`) tokenizes in the browser and returns `Culqi.token.id` ([Checkout Custom](https://docs.culqi.com/es/documentacion/checkout/checkout-custom)).
- The Custom Checkout requires a Culqi `order` for Yape, PagoEfectivo, wallets and Cuotéalo (same page).
- Creating a token directly through the API requires filling Culqi's PCI self-assessment (API spec, tokens).
- `POST /v2/charges` requires `amount` (integer céntimos, 100 to 9,999,900), `currency_code` (`PEN` or `USD`), `email` and `source_id` (`tkn_`, `ype_` or `crd_`) (API spec).
- Optional charge fields: `capture`, `description` (5 to 80 characters), `metadata`, `antifraud_details`, `authentication_3DS` (API spec).
- `metadata` holds at most 20 key-value pairs. Keys have at most 30 characters; values at most 200 (API spec).
- There is no idempotency header. The charge carries `duplicated`: "Indica si ya se realizó un cargo con la misma información." (API spec)
- 3DS, per the API spec: HTTP 200 with `action_code: "REVIEW"` ("Se requieren parámetros 3DS"); HTTP 201 with the charge.
- 3DS, per the [Culqi3DS library page](https://docs.culqi.com/es/documentacion/culqi-3ds/v1/uso-libreria/): the codes are the other way round (200 success, 201 authentication). The [3DS flow page](https://docs.culqi.com/es/documentacion/culqi-3ds/flujo-con-3ds/) agrees with the API spec. The docs disagree.
- The 3DS retry sends the same `source_id` and the same `antifraud_details.device_finger_print_id`, plus `authentication_3DS` (`eci`, `xid`, `cavv`, `protocolVersion`, `directoryServerTransactionId`) (library page).
- `Culqi3DS.generateDevice()` returns the device id. `Culqi3DS.initAuthentication(tokenId)` runs the authentication (library page).
- Capture ([Captura](https://docs.culqi.com/es/documentacion/pagos-online/cargo-unico/captura/)):
  - `capture: true` captures at creation.
  - `capture: false` holds the charge up to 4 days; then the money returns to the customer automatically.
  - With the field empty, Culqi captures at 12 a.m. The API spec says instead that the default is `true`.
  - A captured charge cannot be annulled. It must be refunded, which "puede tomar hasta 30 días dependiendo del banco".
  - `POST /v2/charges/{id}/capture` captures a held charge.
- `POST /v2/refunds` takes `amount` (céntimos), `charge_id` and an optional `reason`: `duplicado`, `fraudulento` or `solicitud_comprador`. Partial refunds may repeat until the charge is fully refunded. A refund's `status` is `Completa`, `Pendiente` or `Rechazado` (API spec).
- `GET /v2/charges` filters by `email`, `amount`, `creation_date_from` and `creation_date_to` (UNIX timestamps), and pages with `limit`, `before` and `after`. It has no metadata filter (API spec).
- Errors carry `type`, `code`, `decline_code`, `merchant_message`, `user_message`, and the `charge_id` of a denied charge (API spec).
- Error types: `card_error`, `invalid_request_error`, `authentication_error`, `parameter_error`, `limit_api_error`, `resource_error`, `api_error`.
- Decline codes: `expired_card`, `stolen_card`, `lost_card`, `insufficient_funds`, `contact_issuer`, `invalid_cvv`, `too_many_attempts_cvv`, `issuer_not_available`, `issuer_decline_operation`, `invalid_card`, `processing_error`, `fraudulent`, `culqi_card`, `soft_block`. The test cards page also uses `incorrect_cvv`.
- Webhooks are configured in the CulqiPanel. Neither the [webhook guide](https://docs.culqi.com/es/documentacion/pagos-online/webhooks/) nor the API spec documents a signature or any other way to verify a payload.
- `GET /v2/events/{id}` returns an event, authenticated with the secret key (API spec).
- Charge events include `charge.creation.succeeded`, `charge.creation.failed`, `charge.expired`, `charge.capture.succeeded` and `charge.capture.failed`. Refund events: `refund.creation.succeeded`, `refund.creation.failed`, `refund.update.succeeded`, `refund.update.failed` (API spec).
- Yape: "Los pagos con Yape tienen un monto máximo de S/ 2000". Soles only. The approval code lasts 2 minutes at most ([Cargos Únicos – Yape](https://docs.culqi.com/es/documentacion/pagos-online/cargo-unico/tokens-yape)).

**Accepted decisions this ADR builds on**

- ADR 0001: the Culqi provider converts amounts to integer céntimos by parsing the decimal. A payable amount with a fraction of a céntimo throws.
- ADR 0003: payments are captured when the order is placed.

## Decision

1. **Card data never touches our servers** (approved, R1).
   - Culqi's Custom Checkout tokenizes the card in the browser.
   - The storefront sends only the token id.
   - `PaymentCard` exists only in the storefront's mock adapter.

2. **Two Medusa units and one client** (proposed).

   | Unit | Path | Role |
   |---|---|---|
   | Payment provider `culqi` | `src/modules/culqi-payment` | `AbstractPaymentProvider` with `static identifier = "culqi"`, registered with `id: "culqi"`. Provider id: `pp_culqi_culqi` |
   | Module `culqi` | `src/modules/culqi` | Stores reconciliation records (`culqi_reconciliation`). Fields in the data model (T7) |
   | Culqi client | `src/lib/culqi` | HTTP calls, response classifier, céntimos converter (ADR 0001). No Medusa imports |

   - The provider keeps no records of its own. Whether a module provider can own data models: Not verified; F3 spike. This design does not need it.
   - Provider methods at a glance:

   | Method | Culqi call | Behavior |
   |---|---|---|
   | `initiatePayment` | None | Stores `amount_cents` and `currency_code` from Medusa's input. Ignores any `data` the storefront sent |
   | `updatePayment` | None | Recomputes `amount_cents` from Medusa's input. Never touches `client` |
   | `authorizePayment` | Lookup, then `POST /v2/charges` | Decisions 4, 7 and 8 |
   | `capturePayment` | None for a captured charge | Decision 6 |
   | `refundPayment` | `POST /v2/refunds` | Decision 11 |
   | `cancelPayment` | `POST /v2/refunds` when a charge exists | Decision 12 |
   | `deletePayment` | None | Decision 12 |
   | `retrievePayment` | `GET /v2/charges/{id}` | Returns the provider fields |
   | `getPaymentStatus` | `GET /v2/charges/{id}` when a charge exists | No charge: `pending`. REVIEW pending: `requires_more`. Captured: `captured`. Declined: `error` |
   | `getWebhookActionAndData` | `GET /v2/events/{id}` | Decision 10 |

3. **Keys and options** (proposed, except where marked).
   - Backend env `CULQI_SECRET_KEY` feeds provider option `secretKey`. It never reaches the storefront, the logs or session data.
   - Storefront env `NEXT_PUBLIC_CULQI_PUBLIC_KEY`. Only the public key reaches the browser.
   - Provider option `yapeEnabled`, default `false` (decision 13).
   - `validateOptions` throws when `secretKey` is missing or lacks the `sk_test_` or `sk_live_` prefix.
   - `validateOptions` refuses an `sk_live_` key unless option `liveEnabled` is `true`.
   - Test keys during development; live charges only after the business registration (approved, #30).

4. **Checkout flow** (proposed).

   | # | Who | Step |
   |---|---|---|
   | 1 | Storefront server | On the payment step, ensures the cart's payment collection and initializes a `pp_culqi_culqi` session |
   | 2 | Provider | `initiatePayment` stores `amount_cents` and `currency_code`. No Culqi call |
   | 3 | Browser | `Culqi3DS.generateDevice()` returns the device id. The Custom Checkout returns the token id |
   | 4 | Storefront server | Re-reads the cart and compares the quote (decision 8). On a match, calls the Update Payment Session route with `client_data: { token_id, email, device_finger_print_id }` |
   | 5 | Storefront server | `POST /store/carts/:id/complete` |
   | 6 | Medusa | `validate` hook: the session's `amount_cents` equals the cart total in céntimos, and `data.client.email` equals the cart email. A mismatch throws before the order exists |
   | 7 | Provider | `authorizePayment` runs the duplicate guards (decision 8), then `POST /v2/charges` |
   | 8 | Provider | Classifies Culqi's answer (table below) and returns the session status |

   - The answer is classified by its body, never by its HTTP status, because Culqi's pages disagree on 200 and 201:

   | Culqi answer | Session status | Provider data |
   |---|---|---|
   | Charge object (`chr_` id), captured | `captured` | `charge_id`, `charge_status: "captured"` |
   | `action_code: "REVIEW"` | `requires_more` | `charge_status: "requires_3ds"` |
   | Error object with `type: "card_error"` | `error` | `charge_status: "declined"`, `decline_reason` (decision 14) |
   | Any other error object | `error` | `decline_reason: "try_again"`, logged as an integration error |
   | No answer (timeout, network error, 5xx without a body) | Lookup (decision 8); `error` if still unknown | `charge_status: "unknown"`, `decline_reason: "pending"` |

   - Charge request fields:
     - `amount`: `amount_cents`.
     - `currency_code`: uppercase (`PEN`). Medusa uses lowercase.
     - `email`: `data.client.email`.
     - `source_id`: `data.client.token_id`.
     - `capture: true`.
     - `description: "Compra en Migeanje Store"`.
     - `metadata: { medusa_session_id, medusa_cart_id }`.
     - `antifraud_details: { device_finger_print_id }`.
     - `authentication_3DS`: only on the 3DS retry.

5. **Amounts** (approved, R2 and ADR 0001; the bounds are proposed).
   - The provider converts Medusa's big number to integer céntimos by parsing its decimal string. Never float math.
   - A fraction of a céntimo throws.
   - Amounts outside 100 to 9,999,900 céntimos (S/ 1.00 to S/ 99,999.00) throw in `initiatePayment`. A free order cannot be paid through Culqi; the MVP has none.
   - The amount comes only from provider-owned data. Nothing in `data.client` is read as an amount.

6. **Capture at placement** (proposed; keeps ADR 0003 true).
   - Every charge sends `capture: true` explicitly. Culqi's docs disagree on the default, so the field is never left empty.
   - `authorizePayment` returns `captured` for a successful charge, as the official PayPal provider does with auto-capture.
   - `capturePayment` is idempotent. For a captured charge it returns the data unchanged and calls nothing.
   - `capturePayment` calls `POST /v2/charges/{id}/capture` only for an uncaptured charge. The MVP never creates one.
   - Not verified; F3 spike S1: whether Medusa records a capture (payment captured, order `payment_status` `captured`) when `authorizePayment` returns `captured`, and whether it then calls `capturePayment`.
   - **Flag for the owner: if S1 fails.**
     - `authorizePayment` returns `authorized`, and a subscriber on `order.placed` runs `capturePaymentWorkflow`. `capturePayment` stays a no-op at Culqi.
     - ADR 0003 holds again once the subscriber runs.
     - Between placement and that capture, canceling the order cancels the payment instead of refunding it. `cancelPayment` still refunds at Culqi (decision 12), but Medusa records no refund, so the order view misses its refund line.
     - F3 must close that window before F4.

7. **3DS** (proposed).
   - Culqi's REVIEW maps to `requires_more`. Medusa defines it as an action required before authorization, with 3DS as its example.
   - Round trip:
     1. The first `complete` call answers `type: "cart"` with an error. Medusa reverts the order. No charge exists.
     2. The storefront reads the session: `status: requires_more`, `charge_status: "requires_3ds"`.
     3. The browser runs `Culqi3DS.initAuthentication(token_id)` and receives the 3DS parameters.
     4. The storefront updates the session with `client_data: { authentication_3DS }`. The route accepts sessions in `requires_more`.
     5. The second `complete` call resends the charge with the same `source_id`, the same `device_finger_print_id` and `authentication_3DS`.
   - A failed or timed-out authentication shows `authentication_failed` (decision 14). A new attempt needs a new token.
   - Not verified; F3 spike S2: whether the session keeps its `requires_more` status and data after the completion is reverted. Fallback: the provider throws an error whose message starts with a stable code (`culqi_3ds_required`), and the storefront reads it from the complete response.
   - Not verified; F3 spike S3: the Culqi3DS script and settings, the result shape of `initAuthentication`, and whether the Custom Checkout runs 3DS by itself.

8. **Duplicate charge protection** (proposed). Culqi has no idempotency key. One session gets at most one successful charge, enforced in layers:

   | Risk | Guard | Owner |
   |---|---|---|
   | Same cart completed twice at once | `completeCartWorkflow` takes a lock and returns the same order for the same cart | Medusa (verified) |
   | Session already charged | `authorizePayment` first reads `data.charge_id`. If present, it fetches the charge and returns its state. It never posts a second charge for that session | Provider |
   | Lost response | Before every `POST /v2/charges`, the provider lists charges with the same `email` and `amount` created in the last 24 hours and matches `metadata.medusa_session_id`. A successful match is adopted instead of charging again | Provider |
   | Charged session replaced | Medusa refuses to delete a session whose payment is not canceled or fully refunded | Medusa (verified) |
   | Total changed | Medusa deletes the sessions when the cart total changes. The `validate` hook compares the session amount with the cart total | Medusa (verified) and hook |
   | Customer saw another cart | The F1 fingerprint (below) | Storefront |
   | Anything that still slips through | The reconciliation job refunds charges without an order (decision 15) | Job |

   - Every charge carries `metadata.medusa_session_id` and `metadata.medusa_cart_id`.
   - A new charge with `duplicated: true` is logged. The charge stands; the job decides.
   - A declined attempt also gets a Culqi `charge_id`. Only a successful charge sets `data.charge_id`, so a declined session accepts a new token.
   - Not verified; F3 spike S4: which provider input carries the Medusa session id and the cart id. Medusa's webhook actions return a `session_id`, so the provider must be able to learn it. Without the cart id, the job resolves the cart from the session.
   - Not verified; F3 spike S5: whether a new charge appears in `GET /v2/charges` immediately.
   - F1 fingerprint (FNV-1a):
     - It stays in the storefront's Medusa adapter, computed over the Medusa cart: each line's SKU, quantity, unit price and availability, plus the shipping zone and amount.
     - The payment page posts `{ total, fingerprint }` with the token.
     - Before step 4 of decision 4, the adapter re-reads the cart and compares. On a mismatch, the token is discarded, nothing reaches Medusa, and the customer sees `cart_changed` as in F1.
     - It is never sent to Medusa or Culqi. The server-side guards are the session deletion and the `validate` hook.

9. **Session data** (proposed). Everything in it is public to the storefront.

   | Field | Written by | Content |
   |---|---|---|
   | `amount_cents` | Provider | Integer céntimos from Medusa's amount |
   | `currency_code` | Provider | `PEN` |
   | `charge_status` | Provider | `none`, `requires_3ds`, `captured`, `declined` or `unknown` |
   | `charge_id` | Provider | `chr_…`, only once a charge succeeded |
   | `decline_reason` | Provider | One customer category from decision 14, never a Culqi code |
   | `refunds` | Provider | `[{ id: "ref_…", amount_cents, status }]` |
   | `client.token_id` | Storefront | `tkn_…` (later, with Yape: `ype_…`) |
   | `client.email` | Storefront | The receipt email Culqi requires |
   | `client.device_finger_print_id` | Storefront | From `Culqi3DS.generateDevice()` |
   | `client.authentication_3DS` | Storefront | Only on the 3DS retry |

   - Never stored:
     - The secret key.
     - Card number, CVV or expiry. They never reach our servers.
     - The raw Culqi response.
     - `decline_code`, `outcome`, `merchant_message`, `user_message`.
     - `fraud_score` and antifraud details.
     - Card BIN or last four digits.
   - The token sits in `data.client` because Medusa's update route puts storefront data there. The storefront created it, and it works only with the secret key.
   - `authorizePayment` never copies `client` into the data it returns, so the payment record holds no token.
   - Raw Culqi codes go only to a structured server log, `culqi_charge_failed`, with the session id, charge id, `type` and `decline_code`.

10. **Webhooks** (proposed).
    - Route: `/hooks/payment/culqi_culqi`, registered in the CulqiPanel (Eventos → Webhooks).
    - Culqi documents no signature, so the posted body is never trusted.
    - `getWebhookActionAndData` reads only the event `id` and rejects anything that is not an `evt_` id.
    - It fetches the event with `GET /v2/events/{id}` and the secret key. A failed fetch ends the handling.
    - Events that matter:

    | Event | Why | Handling |
    |---|---|---|
    | `charge.creation.succeeded` | A charge exists; it may lack an order | Log; the job reconciles |
    | `charge.expired` | Should never happen with `capture: true` | Log at error level |
    | `refund.creation.succeeded`, `refund.update.succeeded` | A refund settled, or was made in the CulqiPanel outside Medusa | Log; the job reconciles |
    | `refund.creation.failed`, `refund.update.failed` | A refund Medusa recorded did not happen | Log at error level; the job alerts the owner |

    - In the MVP the handler returns `not_supported` for every event. Medusa never completes a cart or changes a payment because of a webhook.
    - The reconciliation job is the source of truth.
    - Replays are harmless: the same event id is fetched again and only logged.
    - Not verified; F3 spike S6: Culqi's webhook retry policy and the response it expects.

11. **Refunds** (proposed).
    - `refundPayment` converts Medusa's amount to céntimos (ADR 0001, strict) and calls `POST /v2/refunds` with `charge_id` and `reason`.
    - Partial and repeated refunds are allowed. Medusa rejects a refund above the captured amount before the provider runs.
    - Culqi status `Rechazado` makes `refundPayment` throw, so Medusa records no refund.
    - Status `Pendiente` is recorded and kept in `data.refunds`. The job re-checks it with `GET /v2/refunds/{id}`.
    - Statuses are compared case-insensitively. The spec shows both `Completa` and `completa`.
    - Reason mapping, from the Medusa refund reason `code` (seeded in F3):

    | Medusa `code` | Admin label | Culqi `reason` |
    |---|---|---|
    | `customer_request` | "Pedido del cliente" | `solicitud_comprador` |
    | `order_canceled` | "Pedido cancelado" | `solicitud_comprador` |
    | `return` | "Devolución" | `solicitud_comprador` |
    | `duplicate` | "Cobro duplicado" | `duplicado` |
    | `fraud` | "Fraude" | `fraudulento` |
    | None | — | `solicitud_comprador` |

    - Not verified; F3 spike S7: whether the refund reason reaches `refundPayment`. Its documented input is `amount`, `data` and `context`. If it does not, every Medusa refund sends `solicitud_comprador`, and only the job's duplicate refunds send `duplicado`.
    - The owner refunds from the Medusa admin, never from the CulqiPanel, so both systems agree.

12. **Cancel** (proposed).
    - Culqi cannot annul a captured charge; it must be refunded. Every MVP charge is captured.
    - `cancelPayment` without a `charge_id`: nothing to do.
    - `cancelPayment` with a captured charge: full refund of the remaining amount with `solicitud_comprador`, recorded in `data.refunds`.
    - `cancelPayment` with an uncaptured charge: not used in the MVP. How to void one at Culqi: Not verified; F3 spike S8.
    - Normal path: `cancelOrderWorkflow` refunds captured payments through `refundPayment`.
    - `cancelPayment` covers the S1 fallback and the compensation of a failed completion. The customer is never left charged without an order.
    - `deletePayment` never calls Culqi. A deleted session that had a charge is left to the job.

13. **Methods** (proposed).
    - MVP: cards only, through the Custom Checkout.
    - Yape ships behind a flag, off at launch: provider option `yapeEnabled` and storefront env `NEXT_PUBLIC_CULQI_YAPE_ENABLED`, both `false`.
    - With the flag off, the provider rejects `ype_` sources.
    - Why off: the Custom Checkout requires a Culqi `order` for Yape. Orders are an asynchronous flow (`pending_authorization` in Medusa), confirmed by webhooks that carry no signature.
    - Yape is also capped at S/ 2,000 and soles only.
    - Before enabling it: a spike on whether Yape through the checkout can yield a `ype_` token charged synchronously. The storefront offers Yape only when the total is S/ 2,000 or less.

14. **Customer messages** (proposed).
    - Culqi's `user_message` is never shown. It can reveal why a card failed.
    - Fraud-related declines show the same text as any other decline.
    - Every row uses the F1 title "No pudimos procesar el pago", except `pending`.

    | `decline_reason` | Culqi outcome | Message |
    |---|---|---|
    | `declined` | `insufficient_funds`, `stolen_card`, `lost_card`, `fraudulent`, `contact_issuer`, `issuer_decline_operation`, `too_many_attempts_cvv`, `soft_block`, `culqi_card`, any unknown code | "No pudimos aprobar el pago con esta tarjeta. Prueba con otra tarjeta o comunícate con tu banco. No se hizo ningún cargo." |
    | `check_card` | `expired_card`, `invalid_cvv` (`incorrect_cvv` in the test cards), `invalid_card` | "Revisa los datos de tu tarjeta o prueba con otra. No se hizo ningún cargo." |
    | `authentication_failed` | 3DS failed or timed out | "No pudimos verificar el pago con tu banco. Inténtalo de nuevo o prueba con otra tarjeta. No se hizo ningún cargo." |
    | `try_again` | `issuer_not_available`, `processing_error`, any error object that is not a card error | "Algo salió mal al procesar el pago. Espera un momento e inténtalo de nuevo. No se hizo ningún cargo." |
    | `pending` | No answer, and the lookup could not confirm | Title "Estamos confirmando tu pago". Message: "No vuelvas a pagar: revisaremos tu pago y te escribiremos a tu correo." |

    - "No se hizo ningún cargo" appears only when Culqi answered with an error object.
    - The `declined` text replaces the F1 "Tu banco rechazó la tarjeta", because Culqi's own blocks (`soft_block`, `culqi_card`) are not bank declines.

15. **Reconciliation job and the F1 ports** (proposed).
    - Job `culqi-reconcile-charges` in `src/jobs/culqi-reconcile-charges.ts`, every 15 minutes (`*/15 * * * *`).
    - Each run:
      1. Lists the Culqi charges created in the last 48 hours, page by page. Keeps those with `metadata.medusa_session_id`.
      2. Resolves each successful charge to its session, cart and order.
      3. Classifies it: `matched` (an order's payment holds this `charge_id`), `duplicate` (the cart's order was paid by another charge), `orphan` (no order, and the charge is older than 30 minutes) or `unresolved` (the session or cart cannot be found).
      4. Checks again that no order references the charge, then refunds it in full: `duplicado` for `duplicate`, `solicitud_comprador` for `orphan`. An `unresolved` charge is never refunded automatically.
      5. Writes a `culqi_reconciliation` record for every charge that is not `matched`, and alerts the owner.
      6. Re-checks pending refunds. `Rechazado` alerts the owner.
    - The 30-minute grace period keeps the job away from a completion still in progress.
    - F1 port mapping:

    | F1 | Medusa design |
    |---|---|
    | `PaymentGateway.charge(request)` | A `pp_culqi_culqi` session plus `POST /store/carts/:id/complete`. The card becomes `client.token_id` |
    | `ChargeResult` (`approved` or `declined`) | Session `captured`, or `error` with `decline_reason` |
    | `DeclineReason` | The `decline_reason` categories (decision 14). `not_a_test_card` stays in the mock |
    | `ReconciliationLog.record` | Backend only: the job writes `culqi_reconciliation` |
    | `ReconciliationLog.findByCart` | Custom store route `GET /store/carts/:id/payment-reconciliation`, returning the cart's open record. The contract map (T8) confirms it |
    | `PendingReconciliation` | `culqi_reconciliation`: `cart_id`, `session_id`, `charge_id`, `amount` and `currency_code` (ADR 0001), `kind`, `status`, `refund_id`, `created_at`. Final fields in T7 |
    | `order_persist_failed_after_charge` | No longer reachable as such. Medusa creates the order before charging, and its compensation refunds a failed completion. The job covers the rest |
    | `payment_pending_reconciliation` | The storefront shows the pending notice while `findByCart` returns an open record or the session's `charge_status` is `unknown` |

## Consequences

- Card data never reaches our servers. PCI scope stays with Culqi's checkout (R1).
- Each payment costs two Culqi calls: the lookup and the charge. The lookup makes a retry after a lost response safe.
- Refunds reach the customer's card in up to 30 days, depending on the bank. There is no same-day annulment.
- F3 installs Medusa v2.22.1 or later. The Update Payment Session route does not exist before it. Engram #121 recorded v2.21.2 as the latest version; the current documentation supersedes it.
- The API spec declares `email` with bounds 5 to 50. If that is a length limit, longer emails cannot pay (F3 spike S9).
- Totals under S/ 1.00 cannot be paid.
- Declined and 3DS attempts create and revert an order, so `display_id` can skip numbers. ADR 0002 already accepts gaps.
- F3 spikes:

  | # | Question | If the answer is no |
  |---|---|---|
  | S1 | Does Medusa record a capture when `authorizePayment` returns `captured`? Does it then call `capturePayment`? | Decision 6 fallback; owner review of the ADR 0003 window |
  | S2 | Does a reverted completion keep the session's `requires_more` status and data? | Stable error code in the complete response |
  | S3 | Culqi3DS script, settings and result shape. Does the Custom Checkout run 3DS by itself? | Adjust step 3 of the 3DS round trip |
  | S4 | Which provider input carries the session id and the cart id? | The job resolves the cart from the session |
  | S5 | Is a new charge listed by `GET /v2/charges` immediately? | The lookup retries briefly; the job stays the backstop |
  | S6 | Culqi's webhook retries and expected response | Document it; no design change |
  | S7 | Does the refund reason reach `refundPayment`? | Always `solicitud_comprador` |
  | S8 | How is an uncaptured charge voided? | No MVP change; every charge is captured |
  | S9 | Is the spec's `email` bound of 50 a length limit? | No storefront cap needed |
  | S10 | Is the Custom Checkout Culqi's recommended checkout today? | Switch checkouts; the token contract is the same |

- F3 test plan (cards from Culqi's [Tarjetas de prueba](https://docs.culqi.com/es/documentacion/pagos-online/tarjetas-de-prueba)):
  - Keys: sandbox `pk_test_` and `sk_test_`. `validateOptions` rejects a missing key, a wrong prefix, and a live key without `liveEnabled`.
  - Unit, test-first: céntimos conversion (`248.90` gives `24890`; `0.999` throws; `0.99` throws below the minimum; `100000.00` throws above the maximum).
  - Unit, test-first: the response classifier for each row of decision 4, with REVIEW under both HTTP 200 and 201.
  - Unit, test-first: every decline code of decision 14 maps to its `decline_reason`.
  - Success: Visa `4111 1111 1111 1111` places the order with a captured payment. Observe S1.
  - Declines: `4000 0400 0000 0008` (`insufficient_funds`) and `4000 0200 0000 0000` (`stolen_card`) show the same `declined` message.
  - Declines: `5400 0200 0000 0003` (`incorrect_cvv`) shows `check_card`; Diners `3600 010000 0007` (`processing_error`) shows `try_again`.
  - After a decline, a new token on the same session succeeds.
  - 3DS, with email `review@culqi.com`: `4456 5300 0000 1096` (challenge) and `4456 5300 0000 1005` (frictionless) succeed. `4456 5300 0000 1070` (time-out) and `4456 5300 0000 1013` (error) show `authentication_failed`. Observe S2 and S3.
  - Duplicates: two concurrent completions of one cart give one order and one Culqi charge.
  - Duplicates: a completion repeated after success returns the same order and creates no charge.
  - Duplicates: a lost response (a test double drops Culqi's answer after the charge) is followed by a retry that adopts the charge.
  - Duplicates: a charge carrying a session's metadata and no order is refunded by the job with `solicitud_comprador` after the grace period.
  - Duplicates: a second charge on a completed cart is refunded with `duplicado`.
  - Webhook replay: the same event posted twice is fetched twice, logged, answered `not_supported`, and changes nothing.
  - Webhook forgery: a body with an unknown event id is ignored. A real id with altered data uses only the fetched event.
  - Refunds: two partial refunds, then the rest. A refund above the captured amount is rejected before Culqi.
  - Cancel: canceling an order refunds at Culqi, and the ADR 0003 projection shows `cancelado` with its refund line.
- Storefront follow-up (F4):
  - The Medusa adapter replaces the demo gateway: Custom Checkout, Culqi3DS, the update session call and the complete call.
  - `paymentQuote` and its fingerprint stay, computed from the Medusa cart.
  - `DeclineReason` becomes the `decline_reason` categories. `declinedError` gains the new messages.
  - `ReconciliationLog` keeps only `findByCart`, backed by the custom route.
  - The refund detail line from ADR 0003 gains: "Puede tardar hasta 30 días en verse en tu estado de cuenta, según tu banco."
  - The contact step caps the email at 50 characters if S9 confirms the limit.

## Alternatives considered

- **Own card form and Culqi's token API.** Rejected: card data would pass through our code (R1), and direct token creation requires Culqi's PCI self-assessment.
- **Checkout v4** (`Culqi.publicKey`, `Culqi.settings()`). Not chosen: it is the older pattern. Both return a token, so switching is cheap (S10).
- **Pass the token when initializing the session.** Not chosen: it works before v2.22.1, but every attempt deletes and recreates the session, and storefront data would enter the provider-owned part of `data`.
- **Leave `capture` empty (Culqi captures at 12 a.m.).** Rejected: it allows a same-day annulment, but the docs disagree on the default, Medusa would show `authorized` until midnight, and ADR 0003 assumes capture at placement.
- **`capture: false` and capture at fulfillment.** Rejected: held charges expire after 4 days, and backorders take longer.
- **No lookup before charging; rely on the job.** Rejected: a retry after a lost response would charge twice, and the refund can take 30 days to reach the customer.
- **Map `charge.creation.succeeded` to `captured` so Medusa completes the cart.** Deferred: it would rescue lost responses, but it depends on unverified behavior (S1, S4) and lets an unsigned webhook trigger an order. Revisit after F3.
- **A custom webhook route (`/hooks/culqi`) feeding a reconciliation workflow.** Rejected for the MVP: it duplicates the job.
- **Record orphan charges for manual handling, as F1 did.** Rejected: one person runs the store, and the customer's money would stay held until the owner acts. The job refunds only after checking that no order references the charge.
- **Send name, phone and address in `antifraud_details`.** Not chosen for the MVP: better fraud scoring, but more personal data shared with Culqi, and the provider does not receive the address. Revisit if decline rates are high.
- **Yape in the MVP.** Rejected: asynchronous order flow, unsigned webhooks, S/ 2,000 cap.
- **Show Culqi's `user_message`.** Rejected: it can reveal why a card failed, including fraud checks.
