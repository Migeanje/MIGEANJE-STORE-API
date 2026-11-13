# F2 — Contracts, domain and data model, ADRs

- Engram mirror: project `migeanje-store`, topic `odd/f2-contracts-data-model/tasks`
- Inputs: Engram #30 (master summary), #107 (F1 closing summary), #118 (approved resolutions R1–R10), #121 (verified Medusa/Culqi/legal facts), #18 (data decisions), #21 (way of working), #28 (supplier types)
- Status: in progress

## Objective

Design the backend contract before any Medusa code exists: architecture decision records, the data model of every custom module with its module links, the map from each storefront port to a Medusa endpoint, the state machines of order, procurement item and complaint, and the seed plan from the storefront fixtures.

## Problem

F1 built the storefront against in-memory mocks. Several mock behaviors cannot reach production as they are: money without currency, random order numbers that collide, order statuses that ignore cancellations and refunds, a mock auth stack that Medusa already provides, and a payment port that receives card data. F3 needs an unambiguous design to install Medusa and write the custom modules test-first.

## Why

Design decisions made during implementation get made by accident. Writing them down first lets the owner decide each one explicitly and gives F3 a contract to test against.

## Scope

- In: ADRs, data model per custom module (specs, editorial, procurement, complaints, ubigeo-shipping, sunat-billing, culqi) with module links, contract map, state machines, seed plan. All under `docs/`.
- Out: installing Medusa, writing code or migrations (F3); storefront adapters (F4).

## Constraints

- Design only. Every Medusa v2 claim comes from the official documentation (verified facts in Engram #121), not from memory.
- Technical docs in English; customer-facing labels quoted in neutral Peruvian Spanish.
- One owner decision at a time. Decisions already approved in #118 are not reopened.
- Git: one branch and one PR per work slice, Conventional Commits, no AI attribution in files or messages, squash merge done by the owner. Allowed remote operations: push to `origin` (initial commit to `main`, work branches). Not allowed: force push, merging PRs, deleting branches, touching other repos.

## Delivery strategy

Per-slice PRs to `main` (defined by the owner). Each slice branches from the latest `origin/main`; if the previous PR is still open, the new branch starts from it and later merges `main` in (never rebase plus force push). Forecast: about 1,800 authored lines across the slices.

## Tasks

Route legend: inline = parent writes; delegated = one bounded writer (2+ non-trivial files).

- [x] T0 — Bootstrap `main`: `README.md`, `.gitattributes`, `.gitignore`. Route: inline (mechanical). Evidence: `3166e21 chore: initialize repository`, pushed by the owner to `origin/main`. Review: skipped (trivial passive documentation).
- [x] T1 — Slice `docs/f2-money`: ADR 0001 Money, `docs/README.md` index, this document. Route: inline (one non-trivial file). Evidence: `1b95bb0 docs: add ADR 0001 on money representation`; checks: attribution scan clean, relative link resolves, float example verified in Node. Review: assessed `passive`, not due.
- [x] T2 — Slice `docs/f2-orders`: ADR 0002 order number, ADR 0003 order status projection, order state machine. Route: inline (one file per decision, written as each decision lands). Evidence: ADR 0002 in `ac83fe4`; ADR 0003 and `docs/state-machines/order.md` in `c49aede`; pushed, PR pending owner merge; checks: attribution scan clean, relative links resolve, Medusa fields (`Order.canceled_at`, `Fulfillment.packed_at/shipped_at/delivered_at/canceled_at`) checked against the official model references. Review: assessed `passive`, not due.
- [x] T3 — Slice `docs/f2-auth`: ADR 0004 auth ownership in Medusa. Route: inline (one file). Evidence: commit `docs: add ADR 0004 on customer auth` on `docs/f2-auth`; checks: attribution scan clean, links resolve, Medusa session, verification and config facts checked against the official docs. Proposed points pending owner review: built-in email verification required to sign in, guest orders listed by verified email (depends on verification), password reset flow, throttling middleware, non-rolling sessions, account limits and password length middleware. Review: high (auth), owner granted; approved with 4 advisory findings and acknowledged on 2026-11-08. Fixes in `fbebc00 docs: address review findings in ADR 0004`: sign-in throttle under three keys (IP plus email, email, IP), guest orders conditional on verification, points 7 and 9 marked proposed, status line names the `rolling: false` exception.
- [x] T4 — Slice `docs/f2-payments`: ADR 0005 Culqi tokenization and payment provider. Route: delegated (parallel writer). Evidence: commit `docs: add ADR 0005 on Culqi payments` on `docs/f2-payments`; checks: writer readback and link check, parent spot check (sections, attribution scan). Status: proposed, pending owner review. Key risk for the owner: ADR 0003 assumes capture at placement; whether Medusa records a capture when `authorizePayment` returns `captured` is F3 spike S1, with a fallback in the ADR. F3 needs Medusa v2.22.1 or later (Update Payment Session route). Review: high (payments), owner granted; approved with 6 advisory findings and acknowledged on 2026-11-08. Fixes in `036e034 docs: address review findings in ADR 0005`: the lost-response lookup adopts only charges from the last 20 minutes, before the job's 30-minute grace period, so it never adopts a charge the job refunded; the job skips charges already refunded; session `currency_code` stays lowercase; `charge_status: "failed"` for non-card errors; payment attempt cap on completion; token lifetime and charge refunds as F3 spikes S11 and S12.
- [x] T5 — Slice `docs/f2-complaints`: ADR 0006 complaints, complaint state machine. Route: delegated (parallel writer). Evidence: commit `docs: add ADR 0006 on the complaints book and complaint state machine` on `docs/f2-complaints`; checks: writer readback and link check, parent spot check (sections, attribution scan). Status: proposed, pending owner review. Lawyer questions for F5: does the 15-day count start the day after filing; does an online-only store need the physical backup book; final text of the Ley 32495 regulation.
- [x] T6 — Slice `docs/f2-catalog-rules`: ADR 0007 availability mapping, ADR 0008 regime flags (NRUS → B), procurement item state machine. Route: delegated (parallel writer). Evidence: commit `docs: add ADRs 0007 and 0008 and the procurement item state machine` on `docs/f2-catalog-rules`; checks: writer readback and link check, parent spot check (sections, `received`/`canceled` kept for ADR 0003, attribution scan). Status: proposed, pending owner review. Accountant questions: what counts as income and purchases for the NRUS cap, refunds, IPM on comprobantes, when the regime change takes effect.
- [x] T7 — Data model of each custom module and its module links. Over 400 lines, so two slices. Route: delegated (two writers; the first ran in parallel with T4–T6). Part 1 `docs/f2-data-model-catalog`: `docs/data-model/README.md`, specs, editorial, ubigeo-shipping; ADR 0007 amended so brands are product collections and the Apple line is the `apple` collection. Part 2 `docs/f2-data-model-operations`: procurement, sunat-billing, culqi, complaints, customer favorites. Evidence: commits `cb852be` (part 1) and `docs: add data model of procurement, sunat-billing, culqi, complaints and favorites` (part 2); checks: writers' readback, link check and name match against ADRs 0005–0008, parent spot check (sections, attribution scan). Findings for the owner: shipping fits Medusa province geo zones (`pe-lma`, `pe-cal`) with flat options, no calculated provider; `query.graph` can filter by linked fields since v2.18.0 (Engram #481 corrects #121).
- [x] T8 — Slice `docs/f2-contract-map`: storefront port → Medusa endpoint (standard or custom route). Route: delegated (parallel writer with T9). Evidence: commit `docs: add the storefront contract map` on `docs/f2-contract-map`; checks: 39 port methods found in the storefront code, 39 mapped; links and anchors resolve; parent spot check (sections, attribution scan). Status: proposed, pending owner review. Conflicts it found (C1–C6), most important C5: the storefront calls Medusa only from its server, so every per-IP throttle inside Medusa (complaints, "Avísame", tracking) sees one client.
- [x] T9 — Slice `docs/f2-seed-plan`: seed plan from the 19 fixtures and 9 categories. Route: delegated (parallel writer with T8). Evidence: commit `docs: add the seed plan` on `docs/f2-seed-plan`; checks: 9 categories and 19 products in the tables, matching the fixtures (56 variants: 24 in stock, 7 backorder, 25 Apple); links resolve; parent spot check (sections, attribution scan). Status: proposed, pending owner review. Gaps it found: no home for the account's DNI/CE, no field for F1's "featured" order or `model`; demo orders are not seeded.
- [ ] T10 — Close: F2 closing summary in Engram (same format as #107).

## Acceptance criteria

- Every ADR states context, decision, consequences and the owner's approval date.
- Every custom module lists its models (fields, types, constraints) and its links to Medusa models.
- Every storefront port method maps to a Medusa endpoint or a named custom route.
- The order, procurement item and complaint state machines list states, transitions, triggers and guards.
- The seed plan covers all 9 categories and 19 products, with the Apple line kept non-purchasable.

## Checks

Passive documentation: structural readback of each file, link check of relative paths, and a scan for AI attribution before every commit.

## Progress

- 2026-10-05: research done (Engram #121).
- 2026-10-07: push to `origin` authorized by the owner with the scope above.
- 2026-10-07: first push failed (credential manager authenticated as a different GitHub account, 403). Fixed locally: `origin` URL now carries the `Migeanje` username and the repo has a local author identity. Owner pushed `main`, then committed this document to `main` (`0b8e09d`).
- 2026-10-12: D1 decided. ADR 0001 and `docs/README.md` written on `docs/f2-money`.
- 2026-11-04: `docs/f2-money` still open, so `docs/f2-orders` branches from it (merge `main` in after the owner merges). D2 decided; ADR 0002 written. D3 decided; ADR 0003 and the order state machine written.
- 2026-11-04: D4 decided ("Opcion a con todo"). Owner, verbatim: "ya me voy a dormri puedes ir avanzando absolutamente todo lo que puedas sin que sea necesaria mi intervencios porfavor maniana revisaremos rtodos los cambios que hiusite porfa". From here on, forks the owner has not decided are resolved with the recommended option and marked "(proposed)" in each ADR; an ADR with no approved point also says "Proposed — pending owner review" in its Status line. T3–T9 run without stopping. T10 waits for that review. Chain strategy: stacked PRs to `main`, merged in order.
- Route for T4, T5, T6: delegated, three bounded writers in parallel (independent units with disjoint files, several minutes each). T3: inline.
- 2026-11-08: RDD reviews. One review of every slice (23 files, 3,275 lines) exceeded the reviewer's context budget and created nothing, so the review was split per branch. Owner, verbatim: "revision por grupos para q ue e l revisor de gentle ai no   se sature" and "revisa los cambios porfa". The auth and payments slices were granted; both were approved and acknowledged. Owner on the advisory findings, verbatim: "si porfavor dale corregi eso y dale". Fixes committed on `docs/f2-auth` and `docs/f2-payments`, then merged forward through every later branch (merge commits, no rebase). Contract map aligned: sign-in throttle row, payment attempt cap row, C5 now covers the sign-in and payment caps.
- 2026-11-08: the two fix commits (`fbebc00`, `036e034`) were granted by the owner ("en A  elijo la opcion 1  y en B elijo la 1 tambien"), reviewed, approved with advisory findings and acknowledged. Owner on the second batch, verbatim: "listoo vamos con la segunda tanda de una mi neto".
  - Fixes in `a8883bd` (ADR 0004): the per-email lockout lasts as long as the attack; reset stays available and clears the counters; reset requests are throttled; registrations are 30 per hour per IP; the forwarded IP is trusted only with the storefront server credential, and per-IP counts are skipped without it; Redis down refuses sign-in.
  - Fixes in `c75ec68` (ADR 0005): any 5xx goes to the lookup and only a 4xx request error is `failed`; the attempt cap skips the per-IP count without a trusted IP and fails open without Redis; over-cap copy says one hour; the refunded-charge skip is its own job step; grace period and lookup window cross-referenced.
  - Both merged forward through every later branch; the contract map rows and C5 were updated to match. The hook's combined candidate since `55c7239` stays unanswered by the owner.
- 2026-11-08: third review round. Owner, verbatim: "a1 b1  c1". The second fix commits (`a8883bd`, `c75ec68`) and the combined candidate `55c7239..c75ec68` (7 files, 695 lines, four lenses) were reviewed, approved with advisory findings and acknowledged. Owner on the third batch, verbatim: "dale aplicala".
  - `feb74f0` (ADR 0003, order state machine): capture at placement marked as pending spike S1 of ADR 0005 instead of confirmed; `reembolsado` reachable from every progress state, with triggers.
  - `a0dde68` (ADR 0004): credential and IP forwarding ship with the throttle; a credentialed request without an IP skips per-IP counts and alerts; reset quota exhaustion and manual unlock; reset 30 per hour per IP; registrations back to 10 per 15 minutes; session revocation on reset as an F3 spike.
  - `232e45f` (ADR 0005): compensated refunds are never adopted (spike S13, adopt-nothing fallback); the job records before refunding and holds a run lock; the webhook makes no Culqi call while it only logs; live keys wait for C5; Redis outage alert; 4xx without a body goes to the lookup; 3DS failure in the "no charge" rule; 10-minute minimum margin.
  - Merged forward from `docs/f2-orders` through every later branch; the contract map webhook row, throttle rows and C5 were updated to match.
- 2026-11-09: fourth review round. Owner, verbatim: "a1 b1 c1". The third fix commits (`a0dde68`, `232e45f`) and the combined candidate `55c7239..232e45f` (7 files, 721 lines) were reviewed, approved with advisory findings and acknowledged. Owner on the fourth batch, verbatim: "aplica mano dale de una". From here on only serious findings are brought back, not wording.
  - `d15a85a` (ADRs 0002 and 0003, order state machine): rule 6 keeps `en_importacion` until a fulfillment exists, so goods received before the fulfillment never send the order back to `pagado` (a bug in accepted ADR 0003); the procurement subscriber retries and alerts; ADR 0005 decision 6 owns capture at placement; the guest tracking throttle is enforced in the backend with a trusted client IP.
  - `02296d1` (ADR 0004): which counters the admin unlock clears, reset per-IP rationale, window units.
  - `4c0da9b` (ADR 0005): job lock as a renewed lease with stall alerts; a failed refund call is retried under the same record only when S12 shows no refund; webhook reads id and type only, with bounded logging; `liveEnabled` is an operational precondition with a startup alert; Redis fail-open trade-off stated for the owner; guard row points to the S12/S13 fallback.
  - `358e383` (culqi data model): `listStuck` follows the retry rule.
- 2026-11-09: fifth review round. Owner, verbatim: "a1 b1 c1". The fourth fix commits (`02296d1`, `4c0da9b`) and the combined candidate `55c7239..4c0da9b` (7 files, 737 lines) were reviewed, approved and acknowledged. Only serious findings were brought back. Owner, verbatim: "apliquemos los 5".
  - `1b9478d` (order state machine, ADR 0002): canceling the only fulfillment returns to `pagado` only without procurement items, otherwise to `en_importacion`, matching ADR 0003 rule 6 (a contradiction introduced by `d15a85a`); guest tracking fails closed when Redis is down.
  - `e2b7282` (ADR 0005): a failed lost-response lookup never charges; refund retries only when spike S12 confirms immediate visibility, 30 minutes later, at most three times (resolves the step 5 versus step 7 contradiction introduced by `4c0da9b`); job lease of 20 minutes renewed every 5, alert after three skipped runs, coupling stated.
  - `1533c50` (culqi data model): `listStuck` follows the safe retry rule.
- 2026-11-09: sixth review round. Owner, verbatim: "a1 b1 c1" (no group A that round; B and C were granted). `e2b7282` and the combined candidate `55c7239..e2b7282` (7 files, 748 lines) were reviewed, approved and acknowledged. Owner on the serious findings, verbatim: "si porfavor aplicatlos".
  - `484b154` (ADR 0005):
    - A lookup that fails after a charge request that may have reached Culqi ends `unknown`, never `failed`. This fixes a double-charge risk introduced by `e2b7282`.
    - Compensation of a captured charge runs through `refundPayment`, which records refunds and clears `charge_id` like `cancelPayment`.
    - The reconciliation job scans from a watermark with a 50-request budget and stops on `limit_api_error` (spike S14).
    - The refund retry wait is anchored on `refund_attempted_at` and restarts after every attempt.
    - A run that loses its lease stops before refunding; the unique record insert lets only one run refund a charge.
  - `c246ecb` (culqi data model): `refund_attempted_at` and `refund_attempts` on `culqi_reconciliation`; new `culqi_job_run` model (prefix `culrun`) for the watermark and stall alerts; `recordCharge` reports whether it created the record.
- 2026-11-10: seventh and last review round. Owner, verbatim: "Doy mi consentimiento a la ronda 7. Después de esa ronda no hagas más revisiones de F2: lo que aparezca se anota como pendiente de F3."
  - Fixes:
    - `f570f17` (order state machine, ADR 0003): canceling procurement items without canceling the order.
    - `3e280b2` (ADR 0005): job resume cursor, conditional retry claim, only `Completa` refunds clear `charge_id`, deleted-session orphans resolved through the cart, uncaptured cancel path clarified, `try_again` covers a failed pre-charge lookup, `validate` hook lists the currency check.
    - `15dde6d` (culqi data model): cursor fields on `culqi_job_run`, `claimRefundAttempt` as a conditional update.
  - Reviews: `3e280b2` and the combined candidate `55c7239..3e280b2` (7 files, 774 lines) were granted under that consent, approved and acknowledged. `f570f17` and `15dde6d` were assessed passive.
  - Review record of T3 and T4: seven rounds each, every one approved and acknowledged; no blocking finding was ever raised.

## Pending for F3

Findings of the seventh round and earlier non-blocking items, deferred by the owner's decision above. F3 resolves them while it writes the code test-first.

- ADR 0005, reconciliation job:
  - The resume cursor can pass a charge that is still inside its grace period during a multi-run drain, and the watermark can later pass it too. Keep unclassifiable charges behind the cursor, or rescan the last hour on every resume.
  - Where a resumed run's window ends (the original end or the new run's start) is not stated.
  - The listing-order check and the rate-limit measurement both sit under spike S14; split them.
- ADR 0005, compensation refunds: no actor writes a later `Completa` back into the session's `data.refunds` and clears `charge_id`. A session whose compensation refund was `Pendiente` stays `pending` on every retry. Decide the write-back owner, or document that the customer needs a new session.
- ADR 0005, copy: after a failed pre-charge lookup, "No se hizo ningún cargo" is true only for this attempt. A session whose earlier attempt ended `unknown` already stays `pending`; the wording should say "this attempt".
- ADR 0005, optional hardening: the `liveEnabled` startup guard could refuse live completion instead of only alerting, reading a shared environment flag.
- ADR 0003 and the order state machine:
  - A partial shipment with open procurement items shows `en_camino`, because rule 4 outranks rules 5 and 6. Specify it and add a test.
  - `preparando → cancelado` is really a two-step path through `pagado` or `en_importacion`; redraw it.
- ADR 0002:
  - `display_id` past 999999 breaks `formatOrderNumber`. Add a threshold alert or a boundary test.
  - Guest tracking rules (Lima year at the UTC boundary, identical "not found", fail-closed 429) have no named tests.
- ADR 0004: the shared-IP rationale for the reset limit is stated twice.
- Owner decision before live keys: the payment attempt cap fails open when Redis is down (ADR 0005, decision 4).
- Intermediate branches carry an older copy of this document whose "Next step" says "T3–T6 in progress". It disappears as the chain merges in order; this copy on `docs/f2-contract-map` is the current one.

## Decisions log

- D1 (2026-10-12, ADR 0001): amounts with fractions of a céntimo. Payable amounts are strict (the converter throws); informative amounts (tax breakdown) round half-up to two decimals. Rejected: rounding everything at the boundary, because a rounded charge would differ from the payment Medusa recorded and break reconciliation silently.
- D2 (2026-11-04, ADR 0002): order number `MG-YYYY-NNNNNN` is a formatting of Medusa `display_id` (Lima year of `created_at`, zero-padded to six digits). No counter, no `custom_display_id`. Rejected: own yearly correlative (counter plus a subscriber, number missing until it runs). Accepted cost: no yearly reset, reveals volume, admin shows `#412`.
- D3 (2026-11-04, ADR 0003): `cancelado` beats `reembolsado`. A canceled order shows `cancelado` with its refund as a detail line; `reembolsado` only for a full refund of an order that was not canceled (normally after shipment; a full refund without cancellation earlier shows it too). Partial refunds never change the status. Rejected: `reembolsado` first, because every paid order that is canceled is refunded, so `cancelado` would almost never show.

- D4 (2026-11-04, ADR 0004): Medusa cookie session. The Next.js server logs in, opens the session with `POST /auth/session` and keeps the session id in its own httpOnly cookie. Logout destroys the session in Medusa. TTL 7 days. Redis in production. Rejected: JWT in a cookie, because logout cannot revoke it.
- D5 (2026-11-13, contract map C1): the checkout DNI or CE is stored from the contact step. The contact step writes the receipt request with the document and name, and `type` stays null until the receipt step; a factura replaces the document with the RUC. Rejected: moving the document field to the receipt step, because it changes the F1 checkout.
- D6 (2026-11-13, contract map C2): registration creates the Medusa customer with the first and last name, using the registration token, so the F1 form stays. F3 spike: whether Medusa allows it while verification is pending; fallback, the first sign-in asks the names. Rejected as the default: asking the names at the first sign-in.
- D7 (2026-11-13, contract map C3): the "pago en confirmación" notice shows no reference; F4 drops F1 `PendingPayment.reference`. Rejected: showing the Culqi `charge_id`.
- D8 (2026-11-13, contract map C4): accounts keep no DNI or CE. The adapter reads `document` as null, checkout takes it from the cart's receipt request (D5), and F4 drops the field. Rejected: a custom model linked to the customer for checkout prefill. Knock-on fix from D6: `emailVerifiedAt` can no longer be the customer's `created_at`.
- D9 (2026-11-13, contract map C5): per-IP limits in Medusa use the client IP forwarded by the storefront server, trusted only with its secret credential; any other caller is counted by its own address. It ships in F3 with the sign-in throttle and before Culqi live keys, as ADRs 0002, 0004 and 0005 already state. Rejected: limits only at the storefront or the edge.
- D10 (2026-11-13, contract map C6): two simultaneous favorite adds may reach 101; accepted. Rejected: a lock per customer.

## Next step

Open before T10, as of 2026-11-10:

- Owner decisions still open: contract map conflicts C1–C6, and the holiday inconsistency. ADR 0006 counts holidays as business days and rejects keeping a holiday calendar, while the ubigeo-shipping data model keeps a `holiday` table for delivery estimates and its `addBusinessDays` skips holidays. The complaints deadline must never use that helper.
- Owner review of every proposed point.
- The 10 pull requests are not open yet: `origin` has no pull request refs. The owner opens them from the compare links.

Then T10. The slices are stacked PRs to `main`, opened and merged in this order: `docs/f2-money` → `docs/f2-orders` → `docs/f2-auth` → `docs/f2-payments` → `docs/f2-complaints` → `docs/f2-catalog-rules` → `docs/f2-data-model-catalog` → `docs/f2-data-model-operations` → `docs/f2-seed-plan` → `docs/f2-contract-map`. After each squash merge, `main` is merged into the next branch so its diff shows only its own slice. Size: the two data model slices exceed 400 lines (about 480 and 760). Each module page is cohesive and splitting further would separate links from their models, so they need a `size:exception` from the owner. The other slices are under 400.
