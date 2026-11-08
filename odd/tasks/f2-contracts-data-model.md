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

## Decisions log

- D1 (2026-10-12, ADR 0001): amounts with fractions of a céntimo. Payable amounts are strict (the converter throws); informative amounts (tax breakdown) round half-up to two decimals. Rejected: rounding everything at the boundary, because a rounded charge would differ from the payment Medusa recorded and break reconciliation silently.
- D2 (2026-11-04, ADR 0002): order number `MG-YYYY-NNNNNN` is a formatting of Medusa `display_id` (Lima year of `created_at`, zero-padded to six digits). No counter, no `custom_display_id`. Rejected: own yearly correlative (counter plus a subscriber, number missing until it runs). Accepted cost: no yearly reset, reveals volume, admin shows `#412`.
- D3 (2026-11-04, ADR 0003): `cancelado` beats `reembolsado`. A canceled order shows `cancelado` with its refund as a detail line; `reembolsado` only for a full refund of an order that was not canceled (after shipment). Partial refunds never change the status. Rejected: `reembolsado` first, because every paid order that is canceled is refunded, so `cancelado` would almost never show.

- D4 (2026-11-04, ADR 0004): Medusa cookie session. The Next.js server logs in, opens the session with `POST /auth/session` and keeps the session id in its own httpOnly cookie. Logout destroys the session in Medusa. TTL 7 days. Redis in production. Rejected: JWT in a cookie, because logout cannot revoke it.

## Next step

Owner review of every proposed point, then T10. The slices are stacked PRs to `main`, opened and merged in this order: `docs/f2-money` → `docs/f2-orders` → `docs/f2-auth` → `docs/f2-payments` → `docs/f2-complaints` → `docs/f2-catalog-rules` → `docs/f2-data-model-catalog` → `docs/f2-data-model-operations` → `docs/f2-seed-plan` → `docs/f2-contract-map`. After each squash merge, `main` is merged into the next branch so its diff shows only its own slice. Size: the two data model slices exceed 400 lines (about 480 and 760). Each module page is cohesive and splitting further would separate links from their models, so they need a `size:exception` from the owner. The other slices are under 400.
