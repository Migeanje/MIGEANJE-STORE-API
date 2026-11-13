# ADR 0006 — Complaints book: a custom module with a gapless yearly correlative

- Status: Proposed — pending owner review
- Date: 2026-11-04
- Deciders: Owner
- Related: Engram #107 (section 3, complaints), #118 (R3, R10), #121, #30; ADR 0001; ADR 0002; ADR 0003; [complaint state machine](../state-machines/complaint.md)

## Context

- The F1 storefront has a virtual Libro de Reclamaciones. Each Hoja de Reclamación gets the number `NNNNNNNNN-YYYY`: a 9-digit correlative that restarts every year in Lima, then the year (`000000001-2026`).
- F1 sets the answer's due date to 15 business days after the filing date in Lima. It counts Monday to Friday, does not skip holidays, and day 1 is the day after the filing date.
- The F1 sheet holds:
  - provider `{tradeName, legalName, ruc, address}`, snapshotted at filing (`null` while "por definir");
  - consumer `{firstName, lastName, document, email, phone, address {line, ubigeo}, guardian}`;
  - goods `{producto | servicio, orderNumber, amount, description}`;
  - claim `{reclamo | queja, detail, request}`;
  - `responseChannel` (`email | carta`), `declarationAccepted` and `copySentAt`.
- F1 ports: `ComplaintRepository` (`file`, `markCopySent`, `findByNumber`) and `ComplaintNotifier` (`sendCopy`). `file` numbers and stores in one step, so a failure leaves no gap. A copy that fails leaves the sheet filed.
- The constancia opens only in the browser that filed it, for one hour, through the `mg_complaint` cookie (`<number>.<accessToken>`).
- F1 keeps sheets in memory and does not throttle filings.
- R3: Medusa owns complaints numbering and storage, with at least 2 years of retention. R10 leaves open complaint copies through Resend and holidays in business-day math.

Legal facts:

| Fact | Source |
|---|---|
| Reclamo and queja are answered within 15 business days, non-extendable | Ley 31435 (#121); D.S. 101-2022-PCM arts. 6 and 6-B ([El Peruano](https://busquedas.elperuano.pe/dispositivo/NL/2095978-1)); Indecopi: "El proveedor debe responder en un plazo máximo de 15 días hábiles, improrrogables" ([FAQ, 2025-11-12](https://consumidor.gob.pe/wp-content/uploads/2020/07/Preguntas_Respuestas_LR_12.11.2025.pdf)) |
| The answer is written, "vía carta y/o correo electrónico, según haya sido solicitado por el consumidor" | D.S. 101-2022-PCM arts. 6 and 6-B |
| A settlement proposal sent remotely suspends the count for up to 5 business days | D.S. 101-2022-PCM art. 6-A.2(b) |
| Every sheet carries "numeración correlativa y código de identificación" | D.S. 011-2011-PCM art. 5 ([original text, INEI](https://www.inei.gob.pe/media/libro_reclamaciones/DS011_2011_PCM.pdf)). The FAQ asks for a code per establishment only when there are several |
| Sheets are kept "por el lapso de dos (2) años desde la fecha de registro" | D.S. 011-2011-PCM art. 12 |
| A virtual book lets the consumer print the sheet and receive a copy by email | D.S. 011-2011-PCM art. 4; Indecopi FAQ. The copy is automatic per #121 |
| Proof of an email answer: "conservar el correo enviado y/o la constancia de entrega o lectura" | Indecopi FAQ |
| SIREC applies from 3000 UIT of annual income (not us) | [Indecopi](https://consumidor.gob.pe/libro-de-reclamaciones/) |
| Ley 32495 extends the book to e-commerce platforms. A draft regulation (R.M. 244-2026-PCM per #121) was published for comments | [El Peruano, 2026-07-18](https://elperuano.pe/noticia/300583-pcm-publica-proyecto-para-modificar-el-reglamento-del-libro-de-reclamaciones); final text pending |

Medusa and PostgreSQL facts:

- Modules are isolated: "Modules can't access resources, such as services or data models, from other modules." Features that span modules run in workflows ([Module isolation](https://docs.medusajs.com/learn/fundamentals/modules/isolation)).
- A service method runs in one transaction with `@InjectTransactionManager()`, which injects `sharedContext.transactionManager`, and `@MedusaContext()` on the context parameter. The docs pair it with a public `@InjectManager()` method. Raw SQL runs through `transactionManager.execute(...)`. A method that receives the same `sharedContext` runs in the same transaction ([Database operations](https://docs.medusajs.com/learn/fundamentals/modules/db-operations)).
- `MedusaService` generates `list`, `listAndCount`, `retrieve`, `create`, `update`, `delete`, `softDelete` and `restore` methods for each model ([Service factory](https://docs.medusajs.com/learn/fundamentals/modules/service-factory)).
- A model can declare a composite unique index: `.indexes([{ on: [...], unique: true }])` ([Indexes](https://docs.medusajs.com/learn/fundamentals/data-models/indexes)).
- Notification Module:
  - One provider per channel. Medusa stores each notification's `data`, and admin users with `notification:read` can read it ([Notification Module](https://docs.medusajs.com/resources/infrastructure-modules/notification)).
  - A notification has `status` (`pending | success | failure`) and `external_id` ([NotificationDTO](https://docs.medusajs.com/resources/references/types/NotificationTypes/interfaces/types.NotificationTypes.NotificationDTO)).
  - `sendNotificationsStep` accepts `idempotency_key`, "a key to ensure that the notification is sent only once", plus `trigger_type`, `resource_id` and `resource_type` ([sendNotificationsStep](https://docs.medusajs.com/resources/references/medusa-workflows/steps/sendNotificationsStep)).
  - Resend is a custom provider. The guide's sample logs a Resend error and returns `{}` instead of throwing ([Resend guide](https://docs.medusajs.com/resources/integrations/guides/resend)).
- `/admin` routes require an authenticated admin user, available as `req.auth_context.actor_id` ([Protected routes](https://docs.medusajs.com/learn/fundamentals/api-routes/protected-routes)). Every `/store` request needs the `x-publishable-api-key` header ([Publishable API key required](https://docs.medusajs.com/resources/troubleshooting/storefront-missing-pak)).
- `validateAndTransformBody` validates a Zod body (`@medusajs/framework/zod`) and answers 400 `invalid_data` ([Validation](https://docs.medusajs.com/learn/fundamentals/api-routes/validation)). Custom middlewares live in `src/api/middlewares.ts`. The docs describe no built-in rate limiter.
- `emitEventStep` emits "only after the workflow has finished successfully" ([Emit event](https://docs.medusajs.com/learn/fundamentals/events-and-subscribers/emit-event)). Subscribers live in `src/subscribers` ([Events and subscribers](https://docs.medusajs.com/learn/fundamentals/events-and-subscribers)).
- Scheduled jobs live in `src/jobs` with a `name` and a cron `schedule`. The docs do not name the cron timezone ([Scheduled jobs](https://docs.medusajs.com/learn/fundamentals/scheduled-jobs)).
- The Locking Module's default provider is in-memory and "only intended for use in a single-instance environment" ([Locking Module](https://docs.medusajs.com/resources/infrastructure-modules/locking)).
- PostgreSQL:
  - Sequences "cannot be used to obtain 'gapless' sequences": `nextval` is not reclaimed when the transaction aborts ([Sequence functions](https://www.postgresql.org/docs/current/functions-sequence.html)).
  - `INSERT ... ON CONFLICT DO UPDATE` "guarantees an atomic INSERT or UPDATE outcome", and `RETURNING` returns the updated row ([INSERT](https://www.postgresql.org/docs/current/sql-insert.html)).
  - Row locks are released at transaction end. A second `UPDATE` of a locked row waits for the transaction that holds the lock ([Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)).

## Decision

1. **A custom `complaints` module owns the book** (approved, R3). Inside it (proposed):
   - Models: `complaint` (the sheet), `complaint_answer` (appended answers) and `complaint_counter` (one row per Lima year).
   - Rules: numbering, due date, sheet validation, answer guards, and the delivery state of the copy and of email answers.
   - Layout: `domain` (pure rules: number format, due date, guards), `application` (use cases) and `infrastructure` (DML models, transactional repository). The module service is the only entry point.
   - Not owned: the email transport (Notification Module with our Resend provider), ubigeo names (ubigeo-shipping module), the alert transport and orders. Workflows join them, because a module cannot call another module.
   - Fields other slices rely on (T7 defines types and constraints):

   | Model | Fields |
   |---|---|
   | `complaint` | `number` (unique), `year`, `sequence` (unique with `year`), `submission_id` (unique), `submission_hash`, `access_token`, `filed_at`, `response_due_date`, `kind`, `response_channel`, the sheet snapshot (provider, consumer, goods, claim), `claimed_amount` with `currency_code` (ADR 0001), `copy_sent_at`, `copy_attempts`, `answered_at` |
   | `complaint_answer` | `complaint_id`, `body`, `channel`, `communicated_at`, `delivery_attempts`, `notification_id`, `recorded_by` |
   | `complaint_counter` | `year` (unique), `last_sequence` |

2. **Gapless correlative per Lima year.** Medusa numbers the sheets (approved, R3). The mechanism (proposed):
   - The service's public `file` method uses `@InjectManager()` and calls a protected `file_` method with `@InjectTransactionManager()`.
   - Inside that one transaction:
     1. Upsert the year's counter and read the new value. The `UPDATE` branch locks the year's row until commit:

        ```sql
        INSERT INTO complaint_counter (id, year, last_sequence, created_at, updated_at)
        VALUES (:id, :year, 1, now(), now())
        ON CONFLICT (year) DO UPDATE
          SET last_sequence = complaint_counter.last_sequence + 1, updated_at = now()
        RETURNING last_sequence;
        ```

     2. Read `filed_at` from the clock after the upsert. If its Lima year differs from `:year` (the year turned while waiting), throw. The transaction rolls back and `file` retries once with the new year.
     3. Insert the complaint with `year`, `sequence`, `number`, `filed_at` and `response_due_date`, passing the same `sharedContext`.
   - Any error rolls back both writes, so a failed filing never consumes a number. The unique `(year, sequence)` index is the last line of defense.
   - Concurrent filings of the same year queue on the counter row. Within a year, a higher number never has an earlier `filed_at`.
   - The default isolation level is enough: the row lock serializes the increments.
   - The workflow step that calls `file` has no compensation. A filed sheet is never undone.
   - Exact SQL, table and column names, and how the counter row's `id` is generated: Not verified; F3 spike.

3. **Filing route `POST /store/complaints`** (proposed).
   - Public: no customer login. Like every `/store` route, it needs the publishable API key. Signed-in customers file the same way; the sheet is not linked to the account in the MVP.
   - Server-side validation with `validateAndTransformBody` and a strict Zod schema with the F1 rules: lengths, DNI or CE, phone, normalized email, `declaration_accepted: true`. Unknown fields are refused. Ubigeo codes must resolve in the ubigeo-shipping module; the sheet keeps the names.
   - The server sets everything the consumer must not choose: `number`, `filed_at`, `response_due_date`, `access_token` and the provider snapshot (from module options).
   - Re-submitted form: the storefront renders the form with a fresh `submission_id` (UUID) in a hidden field, so it works without JavaScript. The route stores it with a SHA-256 hash of the validated body.

   | Request | Response |
   |---|---|
   | New `submission_id`, valid body | 201. Files the sheet and tries the copy |
   | Same `submission_id`, same body | 200. The same sheet. Nothing is filed or sent again |
   | Same `submission_id`, different body | 409. Nothing is filed |
   | Invalid body or unknown ubigeo | 400 `invalid_data`. Nothing is filed |
   | Over a throttle limit | 429. Nothing is filed |

   - Response body for 201 and 200 (`copy` is `sent` or `pending`):

     ```json
     {
       "complaint": {
         "number": "000000012-2026",
         "filed_at": "2026-11-04T15:20:00.000Z",
         "response_due_date": "2026-11-25",
         "access_token": "<uuid>",
         "copy": "sent"
       }
     }
     ```

   - The storefront writes the `mg_complaint` cookie from it, as in F1: `<number>.<access_token>`, httpOnly, one hour.
   - Constancia read: `GET /store/complaints/:number` with the header `x-complaint-access-token`. It answers only during the first hour after `filed_at`. A wrong number, a wrong token or an expired token all answer 404.
   - The access token is stored as issued. Hashing it would add little: anyone who can read the table can already read the sheets.
   - Throttle, in two layers:
     - Storefront server action: 5 filings per hour per client key (IP plus the `mg_client` cookie, the F1 attempt limiter). Only the storefront sees the consumer's IP.
     - Medusa middleware on the route: 30 filings per hour per source IP, for callers that skip the storefront. Counters live in Redis in production.
     - No global cap: other people's traffic never closes the book to a consumer. More than 10 filings in one hour alert the owner instead.
     - Middleware implementation and which client IP Medusa sees behind a proxy: Not verified; F3 spike.
   - Customer message for 429: "Recibimos varias Hojas de Reclamación desde tu conexión en poco tiempo. Espera unos minutos y vuelve a intentarlo."

4. **Email copy through the Notification Module** (proposed).
   - Channel `email`, our Resend provider, template `complaint-copy`. `data` carries the full sheet: the email is the legal copy of the Hoja. Subject, as in F1: "Copia de tu Hoja de Reclamación 000000012-2026".
   - Our Resend provider throws when Resend fails. The guide's sample returns `{}`, which would hide the failure.
   - First attempt: the route runs `sendComplaintCopyWorkflow` right after `fileComplaintWorkflow` succeeds and reports the result as `copy`. A failure never undoes the filing.
   - Each attempt claims itself first. It increments `copy_attempts` only if `copy_sent_at` is still null and the counter still holds the value it read. Only the winner sends, with `idempotency_key` `complaint-copy:<complaint id>:<attempt>`.
   - `copy_sent_at` is set only when the notification `status` is `success`.
   - Retries: the job `retry-complaint-copies` runs every 15 minutes. It resends copies with `copy_sent_at` null, filed more than 10 minutes ago, with fewer than 8 attempts. After the 8th failure it alerts the owner once.
   - The owner can resend from the admin at any time ("Reenviar copia").
   - The constancia keeps the F1 texts. For `pending` it shows F1's `copyFailed`: "No pudimos enviarte la copia por correo, pero tu Hoja de Reclamación sí quedó registrada. Imprímela o guárdala como PDF; te reenviaremos la copia."
   - Whether a throwing provider leaves a `failure` notification, and whether `sendNotificationsStep` returns the status or a custom step must call `createNotifications`: Not verified; F3 spike.

5. **Business days: Monday to Friday, holidays count as business days** (proposed).
   - `response_due_date` is the filing date in Lima plus 15 business days. Day 1 is the next day. Saturdays and Sundays are skipped; holidays and días no laborables are not.
   - Why it complies: skipping a holiday can only move the legal deadline later. Our date is therefore on or before the legal one, never after.
   - Example: a sheet filed on Tuesday 2026-12-01 is due on Tuesday 2026-12-22. If 8 December is a holiday, the legal deadline is 2026-12-23 or later.
   - No holiday calendar to maintain. A wrong calendar entry could only make us late.
   - The due date is stored at filing and never moves. The art. 6-A suspension is never applied.
   - This keeps F1's rule and closes R10's holiday item for complaints. Delivery estimates at checkout are a separate question.

6. **Owner workflow in the admin** (proposed).
   - UI routes: `src/admin/routes/complaints/page.tsx`, with the sidebar item "Libro de Reclamaciones", and `src/admin/routes/complaints/[id]/page.tsx`.
   - Admin API routes (authenticated by default under `/admin`):

   | Route | Purpose |
   |---|---|
   | `GET /admin/complaints` | List. Filters: `state`, `overdue`, `year`, `q` (number). Open sheets sorted by due date |
   | `GET /admin/complaints/:id` | The sheet as filed, its answers and their delivery status |
   | `POST /admin/complaints/:id/answers` | Append an answer |
   | `POST /admin/complaints/:id/copy` | Resend the copy now |
   | `POST /admin/complaints/:id/answers/:answer_id/send` | Retry an email answer now |

   - List columns: number, filing date, kind, consumer name, due date, business days left, state, copy status.
   - Answer form: "Observaciones y acciones adoptadas" (required). The channel is the one the consumer chose; the form does not offer the other one.
     - `email`: `answerComplaintWorkflow` appends the answer and sends it (template `complaint-answer`, subject "Respuesta a tu Hoja de Reclamación 000000012-2026"). `communicated_at` is the moment the send succeeds. Failures retry like the copy, with `idempotency_key` `complaint-answer:<answer id>:<attempt>`.
     - `carta`: the owner sends the letter first, then records the answer with the date it was delivered. The date is in Lima, not before the filing date and not in the future.
   - `recorded_by` is `req.auth_context.actor_id`.
   - Evidence: the answer keeps its text. The notification keeps what was sent and the id Resend returned (`external_id`). Indecopi accepts the sent email as proof ("y/o"). Resend delivery events are not used in the MVP.
   - A late answer is still recorded and sent. The admin shows it as "Respondido fuera de plazo".
   - Alerts go to the owner's Telegram through n8n, the channel #30 uses for the NRUS cap alert. The module sends them through the Notification Module on the channel `admin-alert`, whose provider posts to an n8n webhook. If ADR 0008 settles a different alert transport, complaints use it; the alerts below stay the same.

   | Alert | Sent by |
   |---|---|
   | New sheet | Subscriber on `complaint.filed` |
   | 5 business days left | Daily job |
   | 2 business days left | Daily job |
   | Due today | Daily job |
   | Overdue | Daily job, every day until answered |
   | Copy or email answer not delivered after 8 attempts | Retry job |
   | More than 10 filings in one hour | Filing route |

   - Alerts carry the number, kind and dates, never personal data: Telegram is a third party. Example: "Reclamo 000000012-2026: vence el 2026-11-25 (2 días hábiles)."
   - The daily job `complaint-deadline-alerts` runs at 08:00 Lima. Lima is UTC−5 all year, so the cron is `0 13 * * *` on a server clock in UTC. Cron timezone: Not verified; F3 spike.

7. **Retention and immutability.** Sheets are kept at least 2 years (approved, R3). The rest (proposed):
   - No automatic deletion in the MVP.
   - The module exposes no delete or soft delete for sheets or answers. The generated `update`, `delete` and `softDelete` methods of `complaint` and `complaint_answer` are blocked. Mechanism: Not verified; F3 spike.
   - The filed sheet never changes. Answers are appended, never edited or deleted.
   - Only three lifecycle columns change after filing: `copy_sent_at` and `answered_at` (set once, never cleared) and `copy_attempts`.
   - Notifications for copies and answers hold personal data in `data`. They follow the same rule: never deleted in the MVP.
   - Provider identification comes from the module options. A production startup check fails while legal name, RUC or address is missing, so a live sheet never prints "Por definir".

8. **The state is derived** (proposed). A sheet is `filed` until an answer reaches the consumer, then `answered`. No status column. Overdue is a condition of a `filed` sheet, not a state. The [complaint state machine](../state-machines/complaint.md) has the details.

## Consequences

- No gaps and no duplicate numbers. A failed filing consumes no number. A double submit returns the first sheet.
- Filings of the same year wait for each other on one row. At a few sheets per month, the wait is negligible.
- The copy reaches the consumer even when Resend is down for a while, and the owner learns when it does not.
- The notification table holds copies of the sheets. Only admin users can read it.
- Around holidays the stored due date is up to a few days earlier than the legal one. The constancia never promises a later date than the law allows, under F1's count start.
- Required F3 tests, written test-first:
  - Numbering: 50 concurrent filings get 1 to 50 with no gap and no duplicate; a failing insert leaves the counter unchanged; the first filing of a year gets 1; a filing at 23:59:59 Lima on 31 December.
  - Due date: weekday, Friday and weekend filings; a filing at 23:30 Lima on 2026-12-31 is due 2027-01-21; ranges with holidays count them as business days.
  - Idempotency: same key with the same body; same key with a different body.
  - Copy: success sets `copy_sent_at`; failure keeps the sheet; two concurrent attempts send once.
  - Immutability: every sheet column equals its filed value after each operation.
  - Answer guards: wrong channel; a carta date before filing or in the future.
- Storefront follow-up (F4):
  - The Medusa adapter maps `ComplaintRepository.file` to `POST /store/complaints` and `findByNumber` to the constancia route.
  - `markCopySent` and `ComplaintNotifier` get no Medusa adapter: the backend sends the copy.
  - The form gains the hidden `submission_id` and the filing throttle.
  - The contract map (T8) defines the mapping.
- Watch items for the owner and a lawyer before launch (F5):
  - Ley 32495 and the final text of the draft R.M. 244-2026-PCM.
  - When the 15-day count starts: on the day after filing (F1) or on the filing day. Not verified against an official source.
  - Indecopi's FAQ asks for a physical backup book "cuando no sea posible el uso del Libro de Reclamaciones Virtual". Whether it applies to an online-only store.

## Alternatives considered

- **A PostgreSQL sequence per year.** Rejected: `nextval` is not reclaimed on rollback, so a failed filing leaves a gap.
- **`MAX(sequence) + 1` without a lock.** Rejected: two concurrent filings read the same maximum, and the unique index turns one of them into an error.
- **The Locking Module around the insert.** Rejected: the default provider is in-memory and single-instance, and the counter row already serializes filings inside the transaction.
- **A holiday calendar for the exact legal deadline.** Rejected: it needs yearly upkeep, including días no laborables decreed at short notice. It gains at most a few days, and a wrong entry makes us late.
- **Using the art. 6-A suspension.** Rejected: it moves the deadline and needs the consumer's reply tracked. The owner answers within 15 business days anyway.
- **Sending the copy only from a subscriber on `complaint.filed`.** Rejected: the constancia could not say whether the copy went out, as F1 does. The retry job already covers late copies.
- **Calling Resend from the complaints module, bypassing the Notification Module.** Rejected: one email transport for the whole store, and the notification record is proof of what was sent. Cost: copies of the sheets in the notification table.
- **A stored status column.** Rejected for the same reason as ADR 0003: the facts already exist, and a copy of them drifts.
- **Overdue as a terminal state.** Rejected: an overdue sheet must still be answered. A terminal state would hide it.
- **A database trigger that blocks updates of sheet columns.** Rejected for now: planning decision 6.2 keeps the schema in DML and generated migrations. Revisit if the service guard proves weak.
- **Deleting sheets automatically after 2 years.** Rejected for the MVP: 2 years is a minimum, and a purge policy needs a lawyer.
- **Email alerts to the owner.** Rejected: #30 uses Telegram for admin alerts.
- **A module link from `complaint` to the order.** Rejected for the MVP: the order number is what the consumer typed, and it can be wrong or belong to someone else. The admin looks it up with the ADR 0002 parser.
- **Rate limiting only at the edge.** Deferred to F5 (R10): the route needs its own limit before a deploy exists.
- **A throttle with a global cap.** Rejected: an attacker could close the book to real consumers.
