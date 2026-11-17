# ADR 0009 — Proportionality: what the MVP builds and what waits for volume

- Status: Accepted — decided by the owner one mechanism at a time
- Date: 2026-11-17
- Deciders: Owner
- Related: Engram #548 (F2 close), #561 (R13, R14); [ADR 0004](0004-customer-auth.md), [ADR 0005](0005-culqi-payments.md), [ADR 0006](0006-complaints-book.md), [ADR 0007](0007-availability-mapping.md), [ADR 0008](0008-regime-flags.md)

## Decision

Every mechanism in ADRs 0004–0008 is classified as **MVP** (built in F3) or **when volume requires it** (deferred, with a concrete trigger). A deferred mechanism keeps its design in its ADR; this ADR says what the MVP does instead and when the deferred design gets built.

Double-charge protection is not negotiable: it is MVP without a vote.

**Result: 42 mechanisms.**

| Outcome | Count | Mechanisms |
|---|---|---|
| MVP as designed | 27 | M1–M5, M7–M9, M11–M16, M19, M24, M26–M28, M30, M31, M34–M37, M39, M41 |
| MVP only if spike S1 fails | 1 | M17 |
| MVP with a deferred part | 9 | M10, M18, M23, M25, M32, M33, M38, M40, M42 |
| Deferred | 5 | M6, M20, M21, M22, M29 |

### ADR 0004 — Customer auth

| ID | Mechanism | Class | Trigger (deferred) or reason (MVP) |
|---|---|---|---|
| M1 | Server-held cookie session with the Redis session store, 7 days | MVP | One config line with Redis already required (R12); in-memory sessions would sign everyone out on every deploy |
| M2 | Email verification (`authVerificationsPerActor`) and its email | MVP | Guest orders appear in the account (point 6); without verification anyone could register another person's email and read them (personal data) |
| M3 | Password reset (Medusa native, 15-minute token, email) | MVP | Medusa provides it; it is also the way out of a lockout (a completed reset clears that email's counters) |
| M4 | Sign-in failure throttle: IP+email 10, email 20, IP 50 per 15 minutes; generic error; fails closed without Redis | MVP | Password guessing does not scale with volume; a deliberate lockout through the email key clears with a password reset |
| M5 | Reset-request throttle: 3 per hour per email, 30 per hour per IP | MVP | Same Redis and middleware as M4; prevents mailbox flooding and protects the sending domain's reputation |
| M6 | Admin unlock action: clears an email's sign-in counters and reset quota | Deferred | [See below](#m6--admin-unlock-action) |
| M7 | Registration throttle: 10 per 15 minutes per IP | MVP | One more key in M4's middleware; every registration sends a verification email (M2), so it protects the sending domain |
| M8 | Trusted client-IP forwarding with the storefront's secret credential (D9) | MVP | Every request comes from the storefront server; without it every per-IP limit (M4, M5, M7, M13, M25, M37) would throttle the whole store. Precondition for `liveEnabled` (M11) |
| M9 | Account-limit middleware: 10 addresses, 100 favorites, password 8–128 | MVP | Simple validations; the API enforces the same rules as the storefront |

### ADR 0005 — Culqi payments

| ID | Mechanism | Class | Trigger (deferred) or reason (MVP) |
|---|---|---|---|
| M10 | Culqi provider `pp_culqi_culqi` and HTTP client; `culqi` module with `culqi_reconciliation` and `culqi_job_run` ([data model](../data-model/culqi.md)) | MVP: provider and client. The `culqi` module and both models: deferred | Same trigger as M20: nothing writes or reads those models until the automated job exists |
| M11 | Key and live guards: `sk_live_` refused unless `liveEnabled`; boot alert when live keys run without the storefront credential | MVP | A few lines and a test; prevents real charges from a wrong `.env` and going live before M8 and M13 |
| M12 | Double-charge protection: `charge_id` guard, pre-charge lookup, ambiguous outcome = `pending`, never charge again | MVP | Not negotiable |
| M13 | Payment-attempt cap: 10 per cart and 30 per IP per hour | MVP | Card testing does not scale with volume; Redis (R12) and M8 exist anyway. Fail-open versus fail-closed stays an owner decision before live keys (#548) |
| M14 | `validate` hook on cart completion: session amount, currency and email equal the cart's | MVP | Money correctness does not depend on volume; one hook and its tests |
| M15 | Quote fingerprint re-check before updating the payment session (storefront) | MVP | The FNV-1a fingerprint already exists in F1; F4 only wires it to the real cart |
| M16 | 3DS round trip: `REVIEW` → `requires_more` → Culqi3DS in the browser → second completion | MVP | Without it, every card whose bank requires authentication fails; that is conversion, not volume |
| M17 | Capture subscriber on `order.placed` | MVP, only if spike S1 fails | Without it, orders stay authorized but not captured and ADR 0003's `pagado` breaks; manual capture per order is error-prone |
| M18 | Culqi webhook handler | MVP: log only. Fetch, dedupe and rate limit: deferred | [See below](#m18--culqi-webhook-handler-deferred-part) |
| M19 | Refund and cancel through the provider, refunds recorded in `data.refunds`, refund reasons | MVP | Admin refunds and Medusa's compensation of a failed completion both run through it; M20's manual refunds assume it |
| M20 | Charge reconciliation job | Deferred | [See below](#m20--charge-reconciliation-job) |
| M21 | Refund re-check and automatic retry (job step 7) | Deferred | [See below](#m21--refund-re-check-and-automatic-retry) |
| M22 | `findByCart` route (`GET /store/carts/:id/payment-reconciliation`) | Deferred | [See below](#m22--findbycart-route) |
| M23 | Yape guard: `yapeEnabled` and `NEXT_PUBLIC_CULQI_YAPE_ENABLED` false, `ype_` tokens refused | MVP: the guard. Enabling Yape: deferred | The owner decides to offer Yape (the same moment fires M18) |

### ADR 0006 — Complaints book

| ID | Mechanism | Class | Trigger (deferred) or reason (MVP) |
|---|---|---|---|
| M24 | Gapless yearly correlative: counter row locked in one transaction, unique (year, sequence) | MVP | Legal requirement (gaps or duplicates in the book); one counter table and one transaction |
| M25 | Filing throttle: storefront 5 per hour per client key, Medusa middleware 30 per hour per IP | MVP: the Medusa layer. The storefront layer: deferred | [See below](#m25--complaint-filing-throttle-storefront-layer) |
| M26 | Idempotent submission: `submission_id` plus SHA-256 of the body | MVP | A double click would leave two immutable sheets that cannot be deleted for 2 years; one unique column and one comparison |
| M27 | Constancia token: `access_token` readable for 1 hour, `mg_complaint` cookie | MVP | Every sheet holds personal data; without the token, changing the id in the URL shows other people's sheets |
| M28 | Copy email with a conditional claim and a Resend `idempotency_key`; a failed send throws and is recorded | MVP | The copy is a legal requirement; a conditional update and a header prevent duplicates (including a double click on "Reenviar copia") and record every failure |
| M29 | Retry job for copies and answers, every 15 minutes, up to 8 attempts | Deferred | [See below](#m29--retry-job-for-complaint-copies-and-answers) |
| M30 | Admin UI and manual tools: list, detail, answer, "Reenviar copia", retry an answer, `recorded_by` audit | MVP | It is how the owner answers within the legal deadline and keeps the proof; it also replaces the deferred M29 |
| M31 | Daily deadline alerts at 08:00 Lima: 5, 2 and 0 business days left, overdue every day | MVP | Missing one deadline is an INDECOPI fine whatever the volume; one daily job |
| M32 | Event alerts: one per `complaint.filed`; flood alert above 10 filings per hour | MVP: the per-sheet alert. The flood alert: deferred | More than 20 sheets in one calendar month (per-sheet alerts become noise; until then 10 sheets in an hour are 10 alerts) |
| M33 | Owner alert channel `admin-alert` to Telegram, no personal data (also ADR 0008) | MVP: the channel, sent straight to the Telegram Bot API. n8n in between: deferred | [See below](#m33--owner-alert-channel-n8n) |
| M34 | Immutability guard: generated `update`, `delete` and `softDelete` blocked; no automatic deletion | MVP | A sheet changed or deleted during its 2-year retention is a legal problem; three overridden methods and their tests |
| M35 | Provider-identity boot check: production refuses to boot without legal name, RUC and address | MVP | An immutable sheet printing "Por definir" cannot be corrected; a few lines and a test |

### ADR 0007 — Availability

| ID | Mechanism | Class | Trigger (deferred) or reason (MVP) |
|---|---|---|---|
| M36 | Server-side availability and limits: `variantAvailability`, `validate` hooks on add, update and complete, `GET /store/variant-availability` | MVP | Core of the mixed inventory and the Apple barriers; server limits already approved (R8) |
| M37 | "Avísame" restock requests: `POST /store/restock-requests` stores a `RestockRequest`, throttled at 10 per hour per IP | MVP | The demand signal tells the owner what to buy. ADR 0007 gives no throttle number; this ADR sets it, reusing M4's middleware and M8. Notifying the customer stays in the "later" roadmap (#30) |
| M38 | Procurement subscriber on `order.placed` with a per-variant lock | MVP: the subscriber (approved). The per-variant lock: deferred | [See below](#m38--per-variant-lock-in-the-procurement-subscriber) |
| M39 | `SupplierOffer` linked to the variant with its lead time; marketplace offers ignored and their purchases refused under Nuevo RUS | MVP | Offers give the backorder lead time availability is computed from; the gate (approved) keeps the store inside Nuevo RUS |

### ADR 0008 — Regime flags

| ID | Mechanism | Class | Trigger (deferred) or reason (MVP) |
|---|---|---|---|
| M40 | Typed regime config `src/config/regime.ts`, boot refused with a forbidden flag on, read-only admin settings page | MVP: the config and the boot check. The read-only page: deferred | The switch to regime B, when flags start to change (until then the config is read in the repository) |
| M41 | Nuevo RUS cap widget: month and year sales and purchases (Lima) plus committed purchases; every supplier purchase recorded | MVP | Approved; the cap counts sales and purchases, and committed purchases come from the procurement module at no extra cost |
| M42 | Cap alert job with `NrusCapAlert` deduplication | MVP: daily at 08:00 Lima. Hourly cadence: deferred | 20 or more orders per day for 7 days in a row. At 2–3 orders a day, going from 80% to 100% of the monthly cap takes about 6 days, so a daily check loses nothing |

## Deferred mechanisms: what the MVP does instead

### M6 — Admin unlock action

- **MVP.** A locked-out customer unlocks the account with a password reset, which clears that email's sign-in counters (M3, M4). In the worst case an attacker also spent the email's reset quota, and the customer waits at most an hour.
- **Fallback.** A runbook documents the Redis command that deletes an email's counters and reset quota by hand. No admin UI.
- **Trigger**, whichever comes first:
  - a customer cannot unlock the account with a reset;
  - 2 lockout complaints in one calendar month.

### M18 — Culqi webhook handler (deferred part)

- **MVP.** The log-only handler ADR 0005 already scopes for the MVP: it accepts `evt_` ids only, cuts the type to 64 characters, escapes it, logs it and answers `not_supported`. It never calls Culqi.
- **Deferred.** Fetching the event, deduplicating it and rate limiting the route. Card payments settle in the synchronous call, so nothing depends on the webhook yet.
- **Trigger.** Yape or any other asynchronous payment method is enabled.

### M20 — Charge reconciliation job

- **MVP.** A daily job at 09:00 Lima lists the Culqi charges of the last 48 hours that carry `metadata.medusa_session_id`. It classifies each one as `matched`, `duplicate`, `orphan` or `unresolved` (ADR 0005 decision 15, steps 2–3) and sends the report to the Telegram `#pagos` channel. It refunds nothing.
  - Without automatic refunds there is nothing to fence or lease: no watermark, cursor, request budget, lease lock or unique record before refunding.
  - The owner refunds `duplicate` and `orphan` charges by hand. An orphan charge has no Medusa order, so its refund is made in the CulqiPanel.
- **Cost accepted.** A retry more than 20 minutes after a lost response charges again (ADR 0005 decision 8). The first charge is refunded by hand within about a day instead of about 45 minutes. The storefront keeps showing "No vuelvas a pagar" while the session's `charge_status` is `unknown`.
- **Trigger**, whichever comes first:
  - 20 or more orders per day for 7 days in a row;
  - 3 or more `duplicate` or `orphan` charges in one calendar month.

### M21 — Refund re-check and automatic retry

- **MVP.** The daily report of M20 also lists every refund that is not `Completa`. The owner closes them in the CulqiPanel. Nothing retries a refund automatically, so no refund can be requested twice.
- **Trigger.** Same as M20: it is a step of that job.

### M22 — `findByCart` route

- **MVP.** No route. The storefront shows "No vuelvas a pagar" only while the session's `charge_status` is `unknown`. Without the automated job nothing writes `culqi_reconciliation` records, so the route would have nothing to read.
- **Cost accepted.** When a session is deleted after an `unknown` outcome (for example, the cart total changed), the customer no longer sees the notice and may pay again. The first charge shows up as `orphan` in the daily report and the owner refunds it.
- **Trigger.** Same as M20: the route reads the records that job writes.

### M25 — Complaint filing throttle (storefront layer)

- **MVP.** Only the Medusa middleware layer: 30 filings per hour per IP, in Redis, with the IP forwarded by M8. It reuses M4's middleware.
- **Deferred.** The storefront layer (5 per hour per client key). It needs its own counter in Next.js, and a bot defeats it by rotating the cookie.
- **Cost accepted.** One abusive person without a bot can file up to 30 sheets per hour instead of 5. Every sheet is immutable for 2 years (M34), so spam cannot be deleted.
- **Trigger**, whichever comes first:
  - more than 10 filings in one hour;
  - any spam sheet.

### M29 — Retry job for complaint copies and answers

- **MVP.** A failed send alerts the owner at once (M28 records the failure). The owner resends from the admin with "Reenviar copia" or by retrying the answer (M30).
- **Trigger**, whichever comes first:
  - 2 or more failed sends in one calendar month;
  - more than 20 sheets in one calendar month.

### M33 — Owner alert channel (n8n)

- **MVP.** A Medusa notification provider for the `admin-alert` channel posts straight to the Telegram Bot API. Every alert this ADR keeps travels through it. This replaces "Telegram (admin alerts via n8n)" from Engram #30.
- **Deferred.** n8n between Medusa and Telegram. It is one more service to host and watch, and when it is down no alert arrives.
- **Trigger.** The first automation that needs more than forwarding a message, such as combining sources or routing by rules.

### M38 — Per-variant lock in the procurement subscriber

- **MVP.** The subscriber computes the shortfall and creates procurement items without a lock.
- **Cost accepted.** Two orders for the same backorder variant handled at the same instant may get the procurement quantity wrong by a unit. At 2–3 orders a day this is close to impossible, and the owner sees the mismatch when buying.
- **Trigger**, whichever comes first:
  - 20 or more orders per day for 7 days in a row (the volume threshold of M20);
  - the first procurement quantity found wrong.

## Context

- The store starts under Nuevo RUS: S/ 8,000 of sales per month, about 55–80 orders per month, or 2–3 per day ([ADR 0008](0008-regime-flags.md), Engram #561 R13).
- F2 designed several mechanisms for a volume this store will not see for a long time. Each one costs build time, tests and things that can break. R13 asked for this pass before writing code.
- A mechanism counts when it costs build or run effort: limits, jobs, locks, retries, alerts, guards, admin tools. Plain domain rules are not listed.

## Consequences

- **F3b and F3c build the MVP column only.** A deferred design stays in its ADR, unchanged, until its trigger fires. When one fires, it is built as its own slice.
- **The owner watches the triggers.** Most read from data the MVP already shows: orders per day, the daily payment report, complaint alerts, lockout complaints.
- **Daily schedule (Lima).** 08:00: complaint deadlines (M31) and the cap check (M42). 09:00: the payment report (M20).
- **F3 spikes.** A spike that gates only a deferred design waits with it. The rest still run in the sub-phase that builds their module (#561 R15).
- **Engram #30 changes.** Admin alerts reach Telegram without n8n (M33).

## Alternatives considered

- **Build every mechanism as designed.** Rejected: at 2–3 orders a day the reconciliation job, its leases and its retries cost more to build and test than the incidents they would handle (R13).
- **Defer by ADR instead of by mechanism.** Rejected: each ADR mixes legal or security guards that do not depend on volume with machinery that does.
