# sunat-billing module

The sunat-billing module owns the comprobante de pago of each order: the receipt the customer asks for at checkout, the boleta (or, behind the `facturas` flag, the factura) issued for the order, its SUNAT series and correlative, and its status. It also keeps the Nuevo RUS cap alerts ([ADR 0008](../adr/0008-regime-flags.md)). It does not own orders, payments, supplier purchases or the regime flags: the flags live in `src/config/regime.ts` (ADR 0008, decision 4) and reach the module through its options. Money follows [ADR 0001](../adr/0001-money-representation.md): `bigNumber` in major units plus lowercase `currency_code`.

What F1 collects (paths in the storefront repository, under `src/modules/checkout/domain/`):

| F1 data | Source | Comprobante field |
|---|---|---|
| Receipt `boleta` | `receipt.ts` | `type` |
| DNI (8 digits) or CE (9–12 letters or digits) of the contact | `customer.ts`, `customer.document` | `customer_document_type`, `customer_document_number` |
| First and last name of the contact | `customer.firstName`, `customer.lastName` | `customer_name` |
| Receipt `factura`: RUC (10 or 20, check digit), razón social (≤ 150), fiscal address (≤ 200) | `receipt.ts`, behind `features.factura` | `customer_document_*`, `customer_name`, `customer_address` |

F1 always asks for a DNI or CE, so every boleta carries the buyer's document. SUNAT requires it when the boleta total is above S/ 700: "Cuando el monto total a pagar, en la boleta de venta supere los S/ 700, será necesario consignar" the buyer's "Apellidos y nombres" and "Número de su Documento de Identidad" ([SUNAT FAQ](https://orientacion.sunat.gob.pe/01-preguntas-frecuentes-comprobantes-de-pago)).

## Models

Medusa adds `created_at`, `updated_at` and `deleted_at` to every data model; soft delete sets `deleted_at` ([Data model properties](https://docs.medusajs.com/learn/fundamentals/data-models/properties)). The tables below leave them out. Every ID uses `model.id({ prefix })` ([id property](https://docs.medusajs.com/resources/references/data-model/property-types/id)). Unique indexes are partial, `where deleted_at` is null ([Indexes](https://docs.medusajs.com/learn/fundamentals/data-models/index)).

### `receipt_request` (ID prefix `rcptreq`)

The receipt the customer chose at checkout. One per cart, through a module link. Medusa carts have no place for an identity document, and metadata holds no business data (Engram #18) (proposed).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `type` | `enum` | `boleta`, `factura`; `factura` only while the `facturas` flag is on (service rule) | |
| `document_type` | `enum` | `dni`, `ce`, `ruc`; `ruc` if and only if `type` is `factura` (check) | |
| `document_number` | `text` | `dni`: `^\d{8}$`; `ce`: `^[A-Z0-9]{9,12}$`; `ruc`: `^\d{11}$` starting with 10 or 20 (checks), plus the check digit (service rule) | F1 patterns |
| `customer_name` | `text` | not blank; at most 150 characters | Boleta: first and last name. Factura: razón social |
| `fiscal_address` | `text` | nullable; at most 200 characters; set if and only if `type` is `factura` (check) | |

Posting the receipt step again updates the cart's request in place.

### `comprobante` (ID prefix `cpe`)

The comprobante issued, or to be issued, for an order. Created when the order is placed. One order can hold more than one, but at most one that is `pending`, `issued` or `accepted` (workflow rule): a rejected or voided comprobante is followed by a new one.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `type` | `enum` | `boleta`, `factura` | Copied from the cart's request |
| `status` | `enum` | `pending`, `issued`, `accepted`, `rejected`, `voided`, `canceled`; default `pending` | See the table below |
| `regime` | `enum` | `nrus`, `b` | Regime when the order was placed. A factura under `nrus` is refused (check) |
| `series` | `text` | nullable; check `^[A-Z0-9]{4}$`; set from `issued` on (check) | A boleta from the taxpayer's own system or a provider starts with "B" ([SUNAT](https://orientacion.sunat.gob.pe/01-concepto-y-caracteristicas-bv-electronica-desde-see-contribuyente)) |
| `number` | `number` | nullable; ≥ 1; set with `series` (check); unique with `type` and `series` | Correlative. "Comienza en 1" (same page) |
| `issue_date` | `text` | nullable; check `^\d{4}-\d{2}-\d{2}$`; set with `series` (check) | Lima date on the comprobante |
| `issuer` | `text` | not blank | Adapter that issues it: `manual` in the MVP (see "Issuer port") |
| `external_id` | `text` | nullable; unique per `issuer` | The provider's ID; null for `manual` |
| `customer_document_type` | `enum` | `dni`, `ce`, `ruc` | Copied from the request |
| `customer_document_number` | `text` | same checks as the request | |
| `customer_name` | `text` | not blank; at most 150 characters | |
| `customer_address` | `text` | nullable; set for `factura` (check) | Fiscal address |
| `total` | `bigNumber` | > 0 | The order total, shipping included. Payable, so exact (ADR 0001, decision 4) |
| `currency_code` | `text` | lowercase | `pen` |
| `taxable_amount` | `bigNumber` | nullable; null under `nrus`, set under `b` (check) | Extracted from tax-inclusive prices (ADR 0008, decision 2) |
| `igv_amount` | `bigNumber` | nullable; set with `taxable_amount` (check) | Rounded half-up to two decimals (ADR 0001, decision 5) |
| `issued_at` | `dateTime` | nullable | |
| `accepted_at` | `dateTime` | nullable | |
| `rejected_at` | `dateTime` | nullable | |
| `rejection_reason` | `text` | nullable; set with `rejected_at` (check) | SUNAT gives "la indicación del motivo del rechazo" ([Resumen diario](https://orientacion.sunat.gob.pe/04-resumen-diario-boleta-de-venta-electronica)) |
| `voided_at` | `dateTime` | nullable | |
| `void_reason` | `text` | nullable; set with `voided_at` (check) | |
| `canceled_at` | `dateTime` | nullable | The order was canceled before issuance |
| `recorded_by` | `text` | nullable | Admin user ID for manual steps |

Status (proposed):

| Status | Label (admin) | Holds when | Next |
|---|---|---|---|
| `pending` | "Pendiente" | Created at `order.placed`; not issued yet | `issued`, `canceled` |
| `issued` | "Emitido" | Series and number assigned; SUNAT's answer not known yet | `accepted`, `rejected`, `voided` |
| `accepted` | "Aceptado" | SUNAT accepted it ("ACEPTADA", same page) | `voided` |
| `rejected` | "Rechazado" | SUNAT rejected it ("RECHAZADA") | Final; a new comprobante follows |
| `voided` | "Anulado" | Given de baja | Final |
| `canceled` | "Cancelado" | The order was canceled while `pending` | Final |

Lines are not stored (proposed). The order keeps them, and the adapter reads them at issuance. The customer sees the comprobante as `<series>-<number>`, for example "Boleta B001-123".

### `nrus_cap_alert` (`NrusCapAlert`, ID prefix `nrusalert`)

One alert per measure, period and threshold (ADR 0008, decision 3).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `measure` | `enum` | `sales_month`, `purchases_month`, `sales_year`, `purchases_year` | The four meters |
| `period` | `text` | `YYYY-MM` for month measures, `YYYY` for year measures (checks) | Lima calendar |
| `threshold_percent` | `number` | 1 to 100 | 80 in the MVP |
| `amount` | `bigNumber` | ≥ 0 | The measure when the threshold was reached |
| `limit_amount` | `bigNumber` | > 0 | 8,000 or 96,000, kept with the alert |
| `currency_code` | `text` | `pen` | Both amounts |
| `notified_at` | `dateTime` | nullable; set once | The Telegram alert went out |

Unique index on (`measure`, `period`, `threshold_percent`). A second run of the job finds the row and emits nothing.

## Module links

Links use `defineLink` ([Module links](https://docs.medusajs.com/learn/fundamentals/module-links)).

| Link | Other side | Cardinality | Options | Why |
|---|---|---|---|---|
| `cart` ↔ `receipt_request` | Cart Module, cart | one-to-one | none | The receipt is chosen before the order exists |
| `order` ↔ `comprobante` | Order Module, order | one-to-many (`isList` on the comprobante side) | none | A rejected or voided comprobante is followed by a new one for the same order |

On a one-to-one link, `link.create` throws when the record is already linked to a different one ([Link](https://docs.medusajs.com/learn/fundamentals/module-links/link)), so the receipt step updates the existing request. The linkable keys for carts and orders are not verified; F3 spike.

## Service operations

The port other code calls. Generated CRUD methods follow the service factory names ([list method](https://docs.medusajs.com/resources/service-factory-reference/methods/list)).

- `upsertReceiptRequest(requestId | null, input)`: validates as F1 `receiptSchema` and `identityDocumentSchema`; refuses `factura` while the flag is off (`factura_not_enabled`).
- `createComprobante(request, { total, currency_code, taxable_amount, igv_amount })`: status `pending`, `regime` from the options.
- `issue(comprobanteId)`: calls the issuer port. With `manual`, it records what the owner typed.
- `recordAnswer(comprobanteId, { accepted, reason })`: `issued` → `accepted` or `rejected`.
- `void(comprobanteId, reason)` and `cancel(comprobanteId)`.
- `listForAdmin(filters)`: pending first, then by `issue_date`.
- `recordThresholds(measures, now)`: for each measure at or above 80% with no alert row, creates the row and returns it. The job emits the event.

### Issuer port

Issuance is electronic, through SEE-SOL or an authorized provider. SEE-SOL can issue the "Boleta de venta electrónica (portal)" ([SUNAT](https://orientacion.sunat.gob.pe/comprobantes-que-se-pueden-emitir-desde-see-sol)).

| Operation | `manual` adapter (MVP, Engram #30) | Provider adapter (later) |
|---|---|---|
| Issue | The owner issues it in SEE-SOL and records series, number and date | API call; the provider returns series, number and its ID |
| SUNAT answer | The owner records it | The adapter reads it from the provider |
| Void | The owner gives it de baja in SEE-SOL and records it | API call |

- Which provider (OSE or PSE; #30 names Nubefact): (proposed: decide in F3).
- Medusa module provider or a plain adapter in `src/lib`: not verified; F3 spike.
- Boletas from the taxpayer's own system go to SUNAT in the resumen diario, "a más tardar hasta el sétimo día calendario siguiente" ([Resumen diario](https://orientacion.sunat.gob.pe/04-resumen-diario-boleta-de-venta-electronica)). A provider adapter must meet it.
- A comprobante "no entregado al cliente" can be given de baja within 7 calendar days ([Operatividad](https://orientacion.sunat.gob.pe/3529-operatividad)). A delivered one needs a nota de crédito, which this model does not hold yet (open items).

### Nuevo RUS cap inputs

The module cannot read other modules ([Module isolation](https://docs.medusajs.com/learn/fundamentals/modules/isolation)). The hourly job `nrus-cap-check` reads the inputs with `query.graph` and passes the four measures to `recordThresholds`.

| Measure | Source | Rule (ADR 0008) |
|---|---|---|
| Sales | Payment Module captures: `Capture.amount` and its `payment.currency_code` ([Capture](https://docs.medusajs.com/resources/references/payment/models/Capture)); the implicit `created_at` in the Lima month or year | Shipping included. Refunds are shown apart, not subtracted |
| Purchases | Procurement `supplier_purchase`: `total` by `issue_date`, times `fx_rate` when the currency is not `pen` ([procurement](procurement.md)) | Freight and fees included; purchases without items count |
| Committed (shown only) | Procurement items `pending`: `quantity × expected_unit_cost` | Items without a cost are counted apart |

The settings page `src/admin/routes/settings/regime/page.tsx` shows the same four meters and the flags (ADR 0008).

### Routes that need this module (proposed; T8 fixes the names)

| Route | Purpose |
|---|---|
| `POST /store/carts/:id/receipt` | Receipt step: boleta, or factura when enabled |
| Order routes (tracking, confirmation, account) | Show the comprobante `type`, `series`, `number` once issued |
| `GET /admin/comprobantes` | Pending to issue, and the rest |
| `POST /admin/comprobantes/:id/issue` | Record a manual issuance |
| `POST /admin/comprobantes/:id/answer`, `POST /admin/comprobantes/:id/void` | SUNAT answer, baja |
| `GET /admin/regime` | The four meters and the flags, read-only |

## Events

- Emitted: `nrus-cap.threshold-reached` (ADR 0008), payload `{ id }` of the alert row (proposed). A subscriber sends the Telegram alert through n8n and sets `notified_at`. `comprobante.issued`, payload `{ id }` (proposed), for the notifications work to email it.
- Consumed: `order.placed` creates the `pending` comprobante from the cart's request. `order.canceled` cancels a `pending` comprobante, and alerts the owner when one is already `issued` or `accepted` ([Events reference](https://docs.medusajs.com/resources/references/events)).
- Guard: the `completeCartWorkflow` `validate` hook refuses a cart without a receipt request (`receipt_required`) and a factura while the flag is off (`factura_not_enabled`) (proposed).

## Seed and data sources

- No rows. Comprobantes come from orders; alerts from the job.
- Regime flags: code in `src/config/regime.ts`, not seed data.
- Series: none in the MVP; SEE-SOL assigns them. A provider adapter gets its series when the provider is chosen.
- F1 demo orders carry `receipt: { type: "boleta" }`. Whether the seed ports them belongs to the seed plan (T9).

## Open items

- Accountant question: when the comprobante must be issued (at payment, at delivery). Proposed: at payment, since Culqi captures when the order is placed.
- Accountant question: the series SEE-SOL uses for boletas. Not verified on an orientation page.
- Accountant question: credit notes for refunds and for canceled orders whose boleta reached the customer. Proposed: a `credit_note` model with its own series, once the accountant confirms the cases.
- Accountant question: whether the number of a rejected comprobante can be reused.
- Accountant question: whether a factura or boleta must show the IPM apart from the IGV (ADR 0008). The model holds one `igv_amount`.
- Proposed: `receipt_request` on the cart. Alternative: a pending `comprobante` linked to the cart and relinked at placement; fewer models, but abandoned carts leave comprobantes behind.
- Proposed: no line snapshot. Alternative: `comprobante_line` rows, if the provider needs data the order no longer has.
- Proposed: no `none` document type. F1 always collects a DNI or CE. Alternative: allow none for boletas up to S/ 700.
- Proposed: SUNAT document type codes (catalog of document types) are mapped in the adapter, not stored. The catalog is not verified here; F3.
- F3 spike: the linkable keys for carts and orders.
- F3 spike: whether `Capture` exposes `created_at` through `query.graph` filters (the reference lists only `amount`, `created_by`, `payment` and `metadata`).
