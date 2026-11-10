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
- ADR 0003 builds its status precedence on capture at placement. This ADR owns that decision (decision 6), pending F3 spike S1. ADR 0003 itself is accepted; capture at placement is not, until the owner approves decision 6.

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
   | `initiatePayment` | None | Stores `amount_cents` and `currency_code` from Medusa's input, in lowercase as Medusa sends it (`pen`). Ignores any `data` the storefront sent |
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
   - `liveEnabled` is turned on only after the storefront server credential and the client IP forwarding exist (open item C5 of the contract map). Without them the per-IP attempt cap (decision 4) cannot work, and card testing would meet only the per-cart cap and Culqi's antifraud.
     - This is an operational precondition, not a check `validateOptions` can make: the provider cannot see the middleware's configuration.
     - As a guard, the attempt-cap middleware logs at error level and alerts the owner at startup when `liveEnabled` is `true` and the storefront credential is not configured.
   - Test keys during development; live charges only after the business registration (approved, #30).

4. **Checkout flow** (proposed).

   | # | Who | Step |
   |---|---|---|
   | 1 | Storefront server | On the payment step, ensures the cart's payment collection and initializes a `pp_culqi_culqi` session |
   | 2 | Provider | `initiatePayment` stores `amount_cents` and `currency_code`. No Culqi call |
   | 3 | Browser | `Culqi3DS.generateDevice()` returns the device id. The Custom Checkout returns the token id |
   | 4 | Storefront server | Re-reads the cart and compares the quote (decision 8). On a match, calls the Update Payment Session route with `client_data: { token_id, email, device_finger_print_id }` |
   | 5 | Storefront server | `POST /store/carts/:id/complete` |
   | 6 | Medusa | `validate` hook: the session's `amount_cents` equals the cart total in céntimos, its `currency_code` equals the cart's currency, and `data.client.email` equals the cart email. A mismatch throws before the order exists |
   | 7 | Provider | `authorizePayment` runs the duplicate guards (decision 8), then `POST /v2/charges` |
   | 8 | Provider | Classifies Culqi's answer (table below) and returns the session status |

   - A successful answer is classified by its body, never by 200 versus 201, because Culqi's pages disagree on those codes. A 5xx always means the outcome is unknown, even when it carries an error body: Culqi may have stored the charge before failing.

   | Culqi answer | Session status | Provider data |
   |---|---|---|
   | Charge object (`chr_` id), captured | `captured` | `charge_id`, `charge_status: "captured"` |
   | `action_code: "REVIEW"` | `requires_more` | `charge_status: "requires_3ds"` |
   | Error object with `type: "card_error"` | `error` | `charge_status: "declined"`, `decline_reason` (decision 14) |
   | Any other error object with a 4xx status: Culqi rejected the request itself | `error` | `charge_status: "failed"`, `decline_reason: "try_again"`, logged as an integration error. No charge exists |
   | Any 5xx, with or without an error body | Lookup (decision 8); `error` if still unknown | `charge_status: "unknown"`, `decline_reason: "pending"` |
   | No answer (timeout, network error), or any answer that matches no row above, such as a 4xx without a parseable error body | Lookup (decision 8); `error` if still unknown | `charge_status: "unknown"`, `decline_reason: "pending"` |

   - Charge request fields:
     - `amount`: `amount_cents`.
     - `currency_code`: the stored lowercase code, uppercased for Culqi (`pen` becomes `PEN`). The session keeps Medusa's lowercase, so the `validate` hook compares it with the cart's currency directly.
     - `email`: `data.client.email`.
     - `source_id`: `data.client.token_id`.
     - `capture: true`.
     - `description: "Compra en Migeanje Store"`.
     - `metadata: { medusa_session_id, medusa_cart_id }`.
     - `antifraud_details: { device_finger_print_id }`.
     - `authentication_3DS`: only on the 3DS retry.

   - **Payment attempts are capped** (proposed). A declined session accepts a new token (decision 8), so without a cap the checkout could be used to test stolen cards.
     - Only a completion can create a charge. Updating the session with a new token calls nothing at Culqi, so the cap sits on `POST /store/carts/:id/complete`.
     - A middleware on that route allows 10 completions per cart per hour and 30 per client IP per hour, counted in Redis as the sign-in throttle is (ADR 0004, decision 8). A 3DS round trip uses two completions, so one cart gets 5 to 10 payment attempts per hour.
     - Over the cap, the route answers HTTP 429 before any Culqi call. The storefront shows "Hiciste muchos intentos de pago. Vuelve a intentarlo en una hora."
     - Carts are free to create, so the per-IP count is the one that stops card testing. Medusa trusts a forwarded client IP only on requests that carry the storefront server's credential, as for sign-in (ADR 0004, decision 8; open item C5 of the contract map). Any other caller, including one that calls Medusa directly, is counted by its own address, and a forwarded header it sends is ignored.
     - The credential and the forwarding exist before live keys (decision 3). One shared bucket keyed on the storefront server's address would stop every checkout in the store after a few dozen payments, so the per-IP count is never keyed on it.
     - A request that carries the credential but no forwarded IP is a storefront defect. Its per-IP count is skipped, the per-cart cap and Culqi's antifraud still apply, and the owner is alerted at most once per hour while it continues.
     - If Redis is unavailable, the cap fails open: completion proceeds uncounted and the failure is logged at error level. A cache outage must not stop sales. The owner is alerted when Redis stays unavailable for more than 5 minutes, so the window without a cap stays short.
     - Trade-off for the owner: sign-in fails closed on the same outage (ADR 0004, decision 8), because sign-in already depends on Redis for sessions. Failing closed here would stop every sale during the outage, and failing open leaves only Culqi's antifraud against card testing for that window.

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
   | Session already charged | `authorizePayment` first reads `data.charge_id`. If present, it fetches the charge and returns its state, unless the charge was refunded, or the S12 and S13 fallback applies and it returns `unknown` (both below). It never posts a second charge for that session | Provider |
   | Lost response | Before every `POST /v2/charges`, the provider lists charges with the same `email` and `amount` created in the last 20 minutes and matches `metadata.medusa_session_id`. A successful match is adopted instead of charging again | Provider |
   | Charged session replaced | Medusa refuses to delete a session whose payment is not canceled or fully refunded | Medusa (verified) |
   | Total changed | Medusa deletes the sessions when the cart total changes. The `validate` hook compares the session amount with the cart total | Medusa (verified) and hook |
   | Customer saw another cart | The F1 fingerprint (below) | Storefront |
   | Anything that still slips through | The reconciliation job refunds charges without an order (decision 15) | Job |

   - Every charge carries `metadata.medusa_session_id` and `metadata.medusa_cart_id`.
   - The lookup never adopts a charge the job may already have refunded.
     - The lookup window (20 minutes) ends before the job's grace period (30 minutes, decision 15) starts. The job refunds an orphan charge only after the lookup can no longer adopt it, and the 10-minute gap covers a completion still in progress.
     - The lookup also skips a charge that Culqi reports as refunded, if the charge object shows it (F3 spike S12).
     - Cost: a retry more than 20 minutes after a lost response charges again. The job refunds the first charge after its grace period. Meanwhile the storefront shows "No vuelvas a pagar" (decision 14) while `charge_status` is `unknown`.
   - **If the lookup itself fails** (timeout, 5xx or `limit_api_error`), what happens depends on when it ran:
     - **Before a charge request** (the pre-charge lookup), the provider does not charge. Charging without the lookup could charge twice after a lost response, which is the case the lookup exists for. A session whose earlier attempt ended `unknown` stays `unknown` (`pending` for the customer). Any other session ends `error` with `charge_status: "failed"` and `decline_reason: "try_again"`. This attempt sent no charge request, so "No se hizo ningún cargo" is true.
     - **After a charge request that may have reached Culqi** (no answer, a 5xx or an unparseable answer), the session always ends `unknown` (`pending`), never `failed`. Culqi may have charged the card, so the customer reads "No vuelvas a pagar" and the job settles the charge.
     - Cost: while Culqi cannot list charges, checkout cannot charge. That is the price of never charging twice.
   - Neither the `charge_id` guard nor the lookup adopts a charge refunded by a failed completion's compensation. That refund happens at once, inside the lookup window.
     - `compensatePaymentIfNeededStep` refunds a captured payment and cancels an uncaptured one (Medusa context above). Every MVP charge is captured (decision 6), so compensation normally runs through `refundPayment` (decision 11). `cancelPayment` (decision 12) runs when Medusa counts the payment as uncaptured, which happens only under the S1 fallback. At Culqi the charge is captured either way, so both methods refund it.
     - Both methods record every refund that is not `Rechazado` in `data.refunds` with its status. They clear `charge_id` only once the `Completa` refunds cover the charge's full amount.
     - The guard never adopts a charge that has any refund in `data.refunds`, `Pendiente` included. It ends `unknown` (`pending`) and the job settles it. The lookup skips every charge listed in `data.refunds`.
     - A refund that turns `Rechazado` later is not counted, so the charge still counts as charged, and its compensation failure reaches the owner through the job.
     - Whether Medusa writes the data `refundPayment` or `cancelPayment` returns back to the session, where `authorizePayment` reads it, is not verified; F3 spike S13.
     - If S12 holds, the provider also checks the charge's refunds at Culqi before adopting. That covers this case without S13.
     - If S12 and S13 both fail, the provider adopts nothing. An existing `charge_id` or a lookup match ends in `charge_status: "unknown"` (`pending` for the customer), and the job settles the charge. A lost response then costs a refund and a new payment, never an unpaid order.
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
   | `currency_code` | Provider | `pen`: lowercase, as Medusa sends it. Uppercased only in the charge request |
   | `charge_status` | Provider | `none`, `requires_3ds`, `captured`, `declined` (Culqi refused the card), `failed` (Culqi refused the request; no charge exists) or `unknown` |
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
   - When the token leaves the session:
     - The provider never edits `client`; it belongs to the storefront.
     - After a decline, the next attempt's token overwrites it.
     - A deleted session takes it with it.
     - After a successful charge, `authorizePayment` returns data without `client`. Whether Medusa then drops `client` from the session, and whether Culqi refuses a token that already paid a charge: Not verified; F3 spike S11.
     - If neither holds, the token stays visible only to the storefront that created it, and it works only with the secret key, which never leaves the backend.
   - Raw Culqi codes go only to a structured server log, `culqi_charge_failed`, with the session id, charge id, `type` and `decline_code`.

10. **Webhooks** (proposed).
    - Route: `/hooks/payment/culqi_culqi`, registered in the CulqiPanel (Eventos → Webhooks).
    - Culqi documents no signature, so the posted body is never trusted.
    - `getWebhookActionAndData` reads only the event `id` and the claimed `type`, and rejects anything whose id is not an `evt_` id. Nothing else in the body is read.
    - **While the handler only logs (the MVP), it does not fetch the event.** It logs the id and the claimed type, both untrusted, and returns `not_supported`. The type is cut to 64 characters and control characters are escaped before logging, so a forged post cannot inject or flood log lines. Fetching would let anyone who posts made-up ids spend the Culqi API quota that checkout's lookup and charges share.
    - When a later phase acts on events, the handler fetches each event with `GET /v2/events/{id}` and the secret key, after deduplicating ids and rate-limiting the route. A failed fetch ends the handling.
    - Events that matter (the logged type is a hint for the owner; the job checks the facts at Culqi):

    | Event | Why | Handling |
    |---|---|---|
    | `charge.creation.succeeded` | A charge exists; it may lack an order | Log; the job reconciles |
    | `charge.expired` | Should never happen with `capture: true` | Log at error level |
    | `refund.creation.succeeded`, `refund.update.succeeded` | A refund settled, or was made in the CulqiPanel outside Medusa | Log; the job reconciles |
    | `refund.creation.failed`, `refund.update.failed` | A refund Medusa recorded did not happen | Log at error level; the job alerts the owner |

    - In the MVP the handler returns `not_supported` for every event. Medusa never completes a cart or changes a payment because of a webhook.
    - The reconciliation job is the source of truth.
    - Replays are harmless: the same event id is only logged again.
    - Not verified; F3 spike S6: Culqi's webhook retry policy and the response it expects.

11. **Refunds** (proposed).
    - `refundPayment` converts Medusa's amount to céntimos (ADR 0001, strict) and calls `POST /v2/refunds` with `charge_id` and `reason`.
    - Partial and repeated refunds are allowed. Medusa rejects a refund above the captured amount before the provider runs.
    - Culqi status `Rechazado` makes `refundPayment` throw, so Medusa records no refund.
    - Every refund that is not `Rechazado` is recorded in `data.refunds` with its status. The job re-checks a `Pendiente` one with `GET /v2/refunds/{id}`.
    - Once the `Completa` refunds cover the charge's full amount, `refundPayment` clears `charge_id`, so the session no longer counts as charged (decision 8). A `Pendiente` refund does not count until it is `Completa`, and a partial refund keeps `charge_id`. This is the path a failed completion's compensation takes for a captured charge.
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
    - `cancelPayment` with a captured charge: full refund of the remaining amount with `solicitud_comprador`, recorded in `data.refunds` like any refund (decision 11). It clears `charge_id` once that refund is `Completa`, so the session no longer counts as charged (decision 8).
    - `cancelPayment` with a charge uncaptured at Culqi: never happens in the MVP, because every charge is sent with `capture: true`. How to void one at Culqi: Not verified; F3 spike S8.
    - Normal path: `cancelOrderWorkflow` refunds captured payments through `refundPayment`.
    - `cancelPayment` runs only when Medusa counts the payment as uncaptured: under the S1 fallback, before the capture subscriber runs. The charge is still captured at Culqi, so it refunds. A payment Medusa counts as captured is compensated through `refundPayment` (decision 11). The customer is never left charged without an order.
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
    | `try_again` | `issuer_not_available`, `processing_error`, any 4xx error object that is not a card error, or a failed pre-charge lookup (decision 8) | "Algo salió mal al procesar el pago. Espera un momento e inténtalo de nuevo. No se hizo ningún cargo." |
    | `pending` | No answer or a 5xx, and the lookup could not confirm | Title "Estamos confirmando tu pago". Message: "No vuelvas a pagar: revisaremos tu pago y te escribiremos a tu correo." |

    - "No se hizo ningún cargo" appears only when Culqi answered a card decline or a 4xx error object, when the pre-charge lookup failed before any charge request (decision 8), or when 3DS authentication failed (`authentication_failed`). In the 3DS round trip (decision 7), Culqi's first answer asks for authentication and creates no charge, and a failed authentication never sends the second charge request. A 5xx never shows it.
    - The `declined` text replaces the F1 "Tu banco rechazó la tarjeta", because Culqi's own blocks (`soft_block`, `culqi_card`) are not bank declines.

15. **Reconciliation job and the F1 ports** (proposed).
    - Job `culqi-reconcile-charges` in `src/jobs/culqi-reconcile-charges.ts`, every 15 minutes (`*/15 * * * *`).
    - Each run:
      1. Lists the Culqi charges created since its watermark, page by page, and keeps those with `metadata.medusa_session_id`.
         - The watermark is the start of the last completed run minus 1 hour, and never more than 48 hours back. Each window overlaps the previous one by an hour, so a charge still inside its grace period, or listed late (spike S5), is seen again by later runs.
         - The run walks its window oldest first and saves a cursor in its `culqi_job_run` row: the creation time and id of the last charge it finished.
         - A run makes at most 50 Culqi requests (proposed). When it reaches that budget, or Culqi answers `limit_api_error`, it stops at once. The next run resumes from the saved cursor, not from the watermark, so a backlog larger than one budget still drains, a little each run.
         - The watermark advances only when a run reaches the end of its window. A run stopped by the budget does not count as completed for the stall alert below, so a backlog that drains slowly still reaches the owner.
         - If the cursor falls more than 48 hours back, the owner is alerted at once: older charges leave the scan.
         - Whether Culqi's listing pages in a stable order that a creation-time cursor can resume is not documented in what was read; F3 spike S14 checks it.
         - The job shares the Culqi API quota with checkout's lookup, which stops charging on `limit_api_error` (decision 8). The budget keeps the job from starving checkout. Culqi's rate limits are not documented in what was read; F3 spike S14 measures them and sets the budget to a small share of the quota.
      2. Resolves each successful charge to its session, cart and order. When the session is gone, it resolves the cart from the charge's `metadata.medusa_cart_id`.
      3. Classifies it: `matched` (an order's payment holds this `charge_id`), `duplicate` (the cart's order was paid by another charge), `orphan` (no order, and the charge is older than 30 minutes) or `unresolved` (the cart cannot be found, or the session is gone and the job cannot rule out an earlier refund; step 4).
      4. Skips every charge that is already refunded, so nothing is refunded twice:
         - A charge with a `culqi_reconciliation` record is never refunded again; the unique `charge_id` keeps reruns idempotent.
         - A failed completion's compensation refunds through `refundPayment` (decision 11), or `cancelPayment` (decision 12) under the S1 fallback. Both record the refund in the session's `data.refunds`. A charge covered by it gets its record with that refund, no new refund call and no owner alert.
         - If the charge object shows refunds (F3 spike S12), the job checks it too, which also covers a refund made in the CulqiPanel.
         - A deleted session takes its `data.refunds` with it, for example when the cart total changed after a payment ended `unknown`. If S12 holds, the job checks the charge's refunds at Culqi and treats the charge as `orphan` when it finds none, so the customer's money is returned without the owner. Without S12 it cannot rule out a compensation refund, so the charge is `unresolved` and the owner is alerted at once.
      5. For the remaining `duplicate` and `orphan` charges, checks again that no order references the charge, then **writes the `culqi_reconciliation` record first**, with status `refund_pending` and no `refund_id`. The insert is unique per `charge_id`, and only the run whose insert created the record goes on; a run that finds the record already there skips the charge. Only then does it set `refund_attempted_at` and `refund_attempts` and refund the charge in full (`duplicado` for `duplicate`, `solicitud_comprador` for `orphan`) and store the `refund_id`. A crash after the insert and before the refund call leaves the record, with no `refund_attempted_at` when it happened before that field was set. Step 5 never runs again for a charge that has a record; only step 7 decides whether that refund is retried. An `unresolved` charge is never refunded automatically.
      6. Writes the record for every other charge that is not `matched`: `unresolved` ones and ones found already refunded. It alerts the owner, except for a charge it found already refunded.
      7. Re-checks pending refunds. `Rechazado` alerts the owner.
         - A `refund_pending` record without a `refund_id` means a run stopped mid-refund, or the refund call failed (a 5xx or a timeout). The owner is alerted the first time the job finds it.
         - A retry is safe only if a refund Culqi accepted always shows on the charge at once. Otherwise a refund accepted but not yet listed would be requested twice. Whether Culqi rejects a refund above the charge's remaining amount is not verified either.
         - So the job retries only when F3 spike S12 confirms that the charge object shows its refunds and shows a new one immediately.
         - The wait is measured from `refund_attempted_at`, set just before every refund call. A record left by a crash between the insert and the first call has no `refund_attempted_at`, so the wait counts from its `created_at`.
         - A retry runs only when at least 30 minutes have passed since that time. It first checks the charge's refunds and stores the `refund_id` if it finds one. Only when it finds none does it claim the retry and call Culqi again. The 30-minute wait restarts after every attempt, including one that timed out.
         - **The claim is a conditional update.** It adds one to `refund_attempts` and sets `refund_attempted_at` only if `refund_attempts` still holds the value the run read. A run whose update changes no row lost the claim to another run and skips the record. Two overlapping runs therefore never both call Culqi for the same retry.
         - After three attempts, the job alerts the owner and stops retrying.
         - Without that confirmation the job never retries. The owner checks the CulqiPanel and closes the record.
    - **One run at a time.** The job holds a job-level lock (in Redis or the database; F3 picks the mechanism) for the whole run. A run that finds the lock taken, because the previous run outlasted the 15-minute interval, does nothing.
      - The lock is a lease with a 20-minute TTL, renewed every 5 minutes while the run works, so a long run keeps it. A run killed by a deploy or a crash stops renewing it, the lease expires, and a later run proceeds.
      - A run that fails to renew its lease stops before its next refund call. Even if two runs overlap, the unique record insert of step 5 lets only one of them refund a charge.
      - The owner is alerted when three runs in a row find the lock taken, or when no run has completed for an hour. The scan never reaches back more than 48 hours, so a stalled job must be noticed before charges age out of it.
      - **These numbers are coupled.** The renewal period (5 minutes) must stay well below the TTL (20 minutes), so a live run never loses its lease. The TTL must stay shorter than two run intervals (30 minutes), so a run killed right after a renewal causes at most two skipped runs, below the three-skip alert, and deploys raise no false alarm. Change the renewal period, the TTL, the interval and the threshold together.
    - The 30-minute grace period keeps the job away from a completion still in progress.
    - **The grace period and the lookup window are coupled.** The grace period (30 minutes) must stay longer than the lost-response lookup window (20 minutes, decision 8) plus a margin of at least 10 minutes, the longest a completion is expected to stay in progress. Otherwise the job could refund a charge the lookup still adopts, and the order would ship unpaid. Change both numbers together.
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
- Each payment costs two Culqi calls: the lookup and the charge. The lookup makes a retry within 20 minutes of a lost response safe. A later retry charges again, and the job refunds the first charge.
- Payment attempts are capped per cart and per client IP. A customer whose cards keep failing waits up to an hour.
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
  | S11 | Does Medusa drop `data.client` when `authorizePayment` returns data without it? Does Culqi refuse a token that already paid a charge? | The spent token stays visible to the storefront; it is useless without the secret key |
  | S12 | Does Culqi's charge object show its refunds? | The lookup relies on its 20-minute window and `data.refunds`; the job relies on `data.refunds` and its own records, and alerts the owner on an interrupted refund |
  | S13 | Does Medusa write the data `refundPayment` or `cancelPayment` returns back to the session? | With S12 the provider checks refunds at Culqi; without both, it adopts nothing (decision 8) |
  | S14 | What are Culqi's API rate limits, per key and per minute? | Keep the job's budget at 50 requests per run and watch for `limit_api_error` |

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
  - Duplicates: when the pre-charge lookup fails, no charge is posted. `charge_status` stays `unknown` for a session whose earlier attempt ended `unknown`; otherwise it is `failed`, with `decline_reason: "try_again"`.
  - Duplicates: when the lookup that follows an ambiguous charge answer (a 5xx) fails, `charge_status` is `unknown`, never `failed`, and the customer sees `pending`.
  - Duplicates: a charge carrying a session's metadata and no order is refunded by the job with `solicitud_comprador` after the grace period.
  - Duplicates: a second charge on a completed cart is refunded with `duplicado`.
  - Duplicates: after the job refunded an orphan charge, a retry on the same session creates a new charge instead of adopting the refunded one.
  - Duplicates: after a failed completion's compensation refunded the charge through `refundPayment` (and, under the S1 fallback, through `cancelPayment`), a retry on the same session creates a new charge and never adopts the refunded one.
  - Reconciliation: a charge refunded by a failed completion's compensation gets a record with that refund. No second refund is attempted and the owner is not alerted.
  - Reconciliation: a run stopped between the record and the refund call leaves a `refund_pending` record. Step 5 does not refund the charge again; step 7 retries only under the S12 conditions.
  - Reconciliation: a run that starts while the previous one holds the lock does nothing.
  - Reconciliation: a run killed right after renewing its lease causes at most two skipped runs and no alert; a later run proceeds. Three skipped runs in a row alert the owner.
  - Reconciliation: a refund call that fails with a 5xx or times out leaves a `refund_pending` record and alerts the owner. With S12 confirmed, a run at least 30 minutes after `refund_attempted_at` checks the charge's refunds and retries only when it finds none, at most three attempts in all. A retry that times out restarts the wait. Without S12, it never retries.
  - Reconciliation: two overlapping runs reach the same orphan charge; only the run whose record insert succeeds refunds it.
  - Reconciliation: a run that reaches its request budget, or gets `limit_api_error`, stops without advancing the watermark. The next run resumes from the saved cursor, and a backlog larger than one budget drains over several runs.
  - Reconciliation: two overlapping runs reach the same due retry; only the run whose conditional update succeeds calls Culqi.
  - Reconciliation: a charge whose session was deleted is refunded as `orphan` when S12 shows no refund on it; without S12 it is `unresolved` and alerts the owner.
  - Duplicates: a compensation refund still `Pendiente` keeps `charge_id`, and a retry on the same session ends `unknown` instead of adopting the charge.
  - Classifier: a 4xx error object that is not a card error sets `charge_status: "failed"`. A 5xx with an error body, and a 4xx without a parseable body, go to the lookup and end `unknown` when the lookup finds nothing.
  - Currency: the session stores `pen`; the charge request sends `PEN`.
  - Attempts: the eleventh completion of one cart within an hour answers 429 and makes no Culqi call.
  - Attempts: a direct caller sending a forged forwarded IP is counted by its own address.
  - Attempts: a credentialed request without a forwarded IP skips the per-IP count and alerts the owner; with Redis down, completion proceeds and logs the failure.
  - Webhook replay: the same event posted twice is logged twice, answered `not_supported`, makes no Culqi call and changes nothing.
  - Webhook forgery: a body with a made-up event id makes no Culqi call and changes nothing.
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
