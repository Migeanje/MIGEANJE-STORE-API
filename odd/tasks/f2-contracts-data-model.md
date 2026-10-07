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

- [ ] T0 — Bootstrap `main`: `README.md`, `.gitattributes`, `.gitignore`. Route: inline (mechanical).
- [ ] T1 — Slice `docs/f2-money`: ADR 0001 Money, `docs/README.md` index, this document. Route: inline (one non-trivial file).
- [ ] T2 — Slice `docs/f2-orders`: ADR 0002 order number, ADR 0003 order status projection, order state machine.
- [ ] T3 — Slice `docs/f2-auth`: ADR 0004 auth ownership in Medusa.
- [ ] T4 — Slice `docs/f2-payments`: ADR 0005 Culqi tokenization and payment provider.
- [ ] T5 — Slice `docs/f2-complaints`: ADR 0006 complaints, complaint state machine.
- [ ] T6 — Slice `docs/f2-catalog-rules`: ADR 0007 availability mapping, ADR 0008 regime flags (NRUS → B), procurement item state machine.
- [ ] T7 — Slice `docs/f2-data-model`: data model of each custom module and its module links.
- [ ] T8 — Slice `docs/f2-contract-map`: storefront port → Medusa endpoint (standard or custom route).
- [ ] T9 — Slice `docs/f2-seed-plan`: seed plan from the 19 fixtures and 9 categories.
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

## Decisions log

None yet.

## Next step

T0 bootstrap, then T1 decision on money rounding.
