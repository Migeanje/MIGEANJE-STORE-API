# complaints module

The complaints module owns the Libro de Reclamaciones: each Hoja de Reclamación as filed, the answers appended to it, and the yearly counter that numbers it ([ADR 0006](../adr/0006-complaints-book.md)). The state of a sheet is derived, never stored ([complaint state machine](../state-machines/complaint.md)). It does not own the email transport (Notification Module with the Resend provider), ubigeo names ([ubigeo-shipping](ubigeo-shipping.md)), the alert transport or orders. Money follows [ADR 0001](../adr/0001-money-representation.md): the claimed amount is a `bigNumber` in major units plus lowercase `currency_code`.

## Models

Medusa adds `created_at`, `updated_at` and `deleted_at` to every data model; soft delete sets `deleted_at` ([Data model properties](https://docs.medusajs.com/learn/fundamentals/data-models/properties)). The tables below leave them out. Every ID uses `model.id({ prefix })` ([id property](https://docs.medusajs.com/resources/references/data-model/property-types/id)). Unique indexes are partial, `where deleted_at` is null ([Indexes](https://docs.medusajs.com/learn/fundamentals/data-models/index)).

Sheets and answers are never deleted or soft-deleted, so `deleted_at` stays null (ADR 0006, decision 7). Only three `complaint` columns change after filing: `copy_sent_at` and `answered_at` (set once, never cleared) and `copy_attempts`.

### `complaint` (ID prefix `cmpl`)

One Hoja de Reclamación. F1: `ComplaintSheet`. The sheet is stored in typed columns, one per F1 field (proposed). The tables below group them.

Numbering and filing:

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `number` | `text` | unique; check `^\d{9}-\d{4}$` | `000000012-2026`: `sequence` padded to 9 digits, then `year` |
| `year` | `number` | 1000 to 9999 (check) | Lima year of `filed_at` |
| `sequence` | `number` | 1 to 999,999,999 (check); unique with `year` | From `complaint_counter`. Last line of defense against duplicates |
| `submission_id` | `text` | unique; UUID | The form's hidden field. Same ID and body returns the same sheet |
| `submission_hash` | `text` | check `^[0-9a-f]{64}$` | SHA-256 of the validated body. Same ID, different hash: 409 |
| `access_token` | `text` | UUID | Opens the constancia for one hour. Stored as issued (ADR 0006, decision 3) |
| `filed_at` | `dateTime` | | Read from the clock after the counter upsert |
| `response_due_date` | `text` | check `^\d{4}-\d{2}-\d{2}$` | Lima date: filing date plus 15 business days, Monday to Friday (ADR 0006, decision 5). Never moves |
| `kind` | `enum` | `reclamo`, `queja` | F1 `claim.kind` |
| `response_channel` | `enum` | `email`, `carta` | F1 `responseChannel` |
| `declaration_accepted` | `boolean` | check `= true` | F1 `declarationAccepted` |
| `answers` | `hasMany(complaint_answer)` | | Appended, never edited |

Delivery of the copy and of the answer:

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `copy_sent_at` | `dateTime` | nullable; set once | Set when the notification `status` is `success` |
| `copy_attempts` | `number` | ≥ 0; default 0 | Claimed before each send; the 8th failure alerts the owner |
| `answered_at` | `dateTime` | nullable; set once | `communicated_at` of the first answer that reached the consumer |

Provider, snapshotted at filing from the module options:

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `provider_trade_name` | `text` | not blank | "Migeanje Store" |
| `provider_legal_name` | `text` | nullable; not blank | Null only outside production: a startup check refuses to run without it |
| `provider_ruc` | `text` | nullable; 11 digits with a valid check digit (service rule) | Same startup check |
| `provider_address` | `text` | nullable; not blank | Same startup check |

Consumer (F1 `ComplaintConsumer`):

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `consumer_first_name` | `text` | 1 to 60 characters | |
| `consumer_last_name` | `text` | 1 to 60 characters | |
| `consumer_document_type` | `enum` | `dni`, `ce` | |
| `consumer_document_number` | `text` | `dni`: `^\d{8}$`; `ce`: `^[A-Z0-9]{9,12}$` (checks) | |
| `consumer_email` | `text` | trimmed and lowercase; at most 254 characters | Receives the copy and email answers |
| `consumer_phone` | `text` | nullable; check `^\d{6,15}$` | |
| `consumer_address_line` | `text` | 1 to 150 characters | |
| `consumer_distrito_code` | `text` | check `^\d{6}$`; resolves in ubigeo-shipping at filing (service rule) | The provincia and departamento codes are its first 4 and 2 digits |
| `consumer_departamento_name` | `text` | not blank | Names as resolved at filing, so later ubigeo changes do not alter the sheet |
| `consumer_provincia_name` | `text` | not blank | |
| `consumer_distrito_name` | `text` | not blank | |
| `guardian_full_name` | `text` | nullable; 1 to 120 characters | F1 label "Madre, padre o representante", for a minor |
| `guardian_address` | `text` | nullable; 1 to 150 characters | |
| `guardian_phone` | `text` | nullable; check `^\d{6,15}$` | |
| `guardian_email` | `text` | nullable; trimmed and lowercase | |

Check: the other guardian columns are null when `guardian_full_name` is null.

Goods and claim (F1 `ContractedGood`, `Claim`):

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `goods_type` | `enum` | `producto`, `servicio` | |
| `goods_order_number` | `text` | nullable; check `^MG-\d{4}-\d{6}$` | What the consumer typed. Not a link: it can be wrong ([ADR 0002](../adr/0002-order-number.md)) |
| `goods_description` | `text` | nullable; 1 to 500 characters | |
| `claimed_amount` | `bigNumber` | nullable; ≥ 0 | F1 `goods.amount`, converted from céntimos to major units |
| `currency_code` | `text` | nullable; lowercase; set with `claimed_amount` (check) | `pen` |
| `claim_detail` | `text` | 1 to 4,000 characters | "Detalle" |
| `claim_request` | `text` | nullable; 1 to 2,000 characters | "Pedido" |

Index on (`answered_at`, `response_due_date`) for the open-sheets list and the deadline job (proposed).

### `complaint_answer` (ID prefix `cmplans`)

One answer to a sheet. Appended, never edited or deleted.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `complaint` | `belongsTo(complaint)` | required | Column `complaint_id` (ADR 0006) |
| `body` | `text` | 1 to 4,000 characters (proposed) | "Observaciones y acciones adoptadas" |
| `channel` | `enum` | `email`, `carta`; equals the sheet's `response_channel` (service rule) | |
| `communicated_at` | `dateTime` | nullable; set once | `email`: when the send succeeded. `carta`: 00:00 Lima of the delivery date (proposed); not before the filing date, not in the future |
| `delivery_attempts` | `number` | ≥ 0; default 0; 0 for `carta` (check) | Claimed before each email send |
| `notification_id` | `text` | nullable | The Notification Module record of the successful send. A plain ID (proposed) |
| `recorded_by` | `text` | not blank | Admin user ID, `req.auth_context.actor_id` |

### `complaint_counter` (ID prefix `cmplctr`)

One row per Lima year. Written only by the upsert of ADR 0006, decision 2.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | How the raw upsert generates it: Not verified; F3 spike |
| `year` | `number` | unique; 1000 to 9999 (check) | |
| `last_sequence` | `number` | ≥ 1 | The `UPDATE` branch locks the row until commit |

## Module links

None. ADR 0006 rejects a link to the order: the order number is what the consumer typed. Sheets are not linked to customer accounts in the MVP: signed-in customers file like guests.

## Service operations

The service is the only entry point (ADR 0006, decision 1). Generated `update`, `delete` and `softDelete` methods of `complaint` and `complaint_answer` are blocked; mechanism: Not verified; F3 spike.

- `file(input, submission)`: numbers and stores the sheet in one transaction (public `@InjectManager()` method, protected `@InjectTransactionManager()` method; [Database operations](https://docs.medusajs.com/learn/fundamentals/modules/db-operations)). Returns the existing sheet for a known `submission_id` and hash; refuses a known ID with another hash.
- `retrieveForConstancia(number, accessToken, now)`: the sheet during the first hour after `filed_at`; otherwise not found.
- `claimCopyAttempt(id, expectedAttempts)` and `markCopySent(id, at)`: the claim-then-send rule of the state machine.
- `appendAnswer(complaintId, input, actorId)`: checks the channel and, for `carta`, the date; sets `answered_at` the first time.
- `claimAnswerDelivery(answerId, expectedAttempts)` and `markAnswerCommunicated(answerId, at, notificationId)`.
- `stateOf(sheet, today)`: `filed` or `answered`, plus the conditions `copy_pending`, `due_soon`, `overdue`, `answer_delivery_pending`, `answered_late`. Pure.
- `listForAdmin({ state, overdue, year, q })`: open sheets by `response_due_date`.
- `pendingDeliveries(now)`: copies and email answers for `retry-complaint-copies`.
- `dueForAlerts(today)`: sheets at 5 and 2 business days left, due today and overdue, for `complaint-deadline-alerts`.

### Routes that need this module (ADR 0006; T8 fixes the names)

| Route | Purpose |
|---|---|
| `POST /store/complaints` | File a sheet (201, 200, 409, 400, 429) |
| `GET /store/complaints/:number` | Constancia, with `x-complaint-access-token`, first hour only |
| `GET /admin/complaints`, `GET /admin/complaints/:id` | List and detail |
| `POST /admin/complaints/:id/answers` | Append an answer |
| `POST /admin/complaints/:id/copy` | Resend the copy |
| `POST /admin/complaints/:id/answers/:answer_id/send` | Retry an email answer |

## Events

- Emitted: `complaint.filed`, by `emitEventStep` after `fileComplaintWorkflow` succeeds. Payload `{ id }` (proposed): no personal data in event payloads. A subscriber alerts the owner.
- Consumed: none.

## Seed and data sources

- No rows. The first filing of a year creates its counter row.
- Provider identification: module options from the environment. Production refuses to start without legal name, RUC and address (ADR 0006, decision 7).
- Ubigeo names at filing: the ubigeo-shipping module (`resolve`).
- Development sheets are filed through the route; no fixture is ported (proposed).

## Open items

- F3 spike: exact upsert SQL, table and column names, and the counter row's `id`.
- F3 spike: how to block the generated update and delete methods.
- Proposed: one typed column per sheet field. Alternative: `json` snapshots for provider, consumer and goods; fewer columns, but no database checks on the legal fields.
- Proposed: a `carta` answer stores 00:00 Lima of its delivery date. Alternative: a separate `delivered_on` text date, at the cost of two ways to read `answered_at`.
- Proposed: answer body at most 4,000 characters, like F1 `claim.detail`.
- Lawyer questions (F5, ADR 0006): whether the 15-day count starts the day after filing; whether an online-only store needs the physical backup book; the final text of the Ley 32495 regulation.
- Retention: at least 2 years (approved, R3); no automatic deletion in the MVP.
