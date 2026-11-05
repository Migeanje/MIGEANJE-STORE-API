# ADR 0008 — Regime flags: one typed regime setting, from Nuevo RUS to regime B

- Status: Proposed — pending owner review
- Date: 2026-11-04
- Deciders: Owner
- Related: Engram #30 (block 11), #28, #118 (R9), #121; [ADR 0001](0001-money-representation.md), [ADR 0007](0007-availability-mapping.md); [procurement item state machine](../state-machines/procurement-item.md)

## Context

- **The plan (#30).**
  - The store starts under Nuevo RUS: boletas only, S/ 8,000 monthly cap.
  - It moves to regime B (RER or RMT, chosen with the accountant) when nearing the cap, for direct marketplace imports, or when customers ask for facturas.
  - Facturas sit behind a flag. Marketplace suppliers are gated by the regime flag.
  - The admin gets a Nuevo RUS cap widget, and a Telegram alert fires at 80%.
- **Nuevo RUS law** (D. Leg. 937, text updated to 18.2.2022, [SUNAT](https://www.sunat.gob.pe/legislacion/rus/rus.pdf)):
  - Categories by monthly gross income **and** monthly purchases: category 1 up to S/ 5,000, category 2 up to S/ 8,000 (art. 7.1; [SUNAT orientation](https://orientacion.sunat.gob.pe/3100-04-determinacion-y-pago-categorias-del-nrus)).
  - A taxpayer whose income or purchases exceed S/ 96,000 in the year, or exceed the highest category in any month, is outside the regime (art. 3.1 a and d; [SUNAT FAQ](https://orientacion.sunat.gob.pe/08-preguntas-frecuentes)).
  - The regime covers income tax, IGV and IPM (art. 4). A Nuevo RUS sale carries no IGV line.
  - Only comprobantes without tax credit may be issued: boletas and tickets ([SUNAT orientation](https://orientacion.sunat.gob.pe/nuevo-regimen-unico-simplificado-nuevo-rus)).
  - Issuing one that grants credit, such as a factura, moves the taxpayer into the RMT or the general regime from the month of issue (art. 16.2).
  - Customs operations are excluded (art. 3.2 c).
- **IGV.** The rate applied is 18%. Under Ley 32387 the split moves from IGV toward IPM each year (2026: IGV 15.5% + IPM 2.5%). The total stays 18% through 2029 ([SUNAT orientation](https://orientacion.sunat.gob.pe/3053-concepto-tasa-y-operaciones-gravadas-igv-empresas)).
- **Storefront.** `src/shared/config/features.ts` has `factura: false`. Its comment says flags are "typed and in code, so turning one on is a reviewed change with its own commit (and CI), not an environment variable". Server actions read the same value.
- **Medusa.**
  - Feature flags "allow you to ship new features that are still under development and testing". Disabling one requires rolling back the migrations that depend on it ([Feature Flags](https://docs.medusajs.com/learn/debugging-and-testing/feature-flags)).
  - A tax region is created per country. Its name, rate and code are optional ([Tax Regions guide](https://docs.medusajs.com/user-guide/settings/tax-regions); [Tax Region concept](https://docs.medusajs.com/resources/commerce-modules/tax/tax-region)). A 0% rate is not documented.
  - A region has an "Automatic Taxes" toggle and a tax-inclusive pricing setting ([Regions guide](https://docs.medusajs.com/user-guide/settings/regions)).
  - A price preference sets `is_tax_inclusive` for a `region_id` or a `currency_code`. Medusa then extracts the tax from the price instead of adding it ([Tax-inclusive pricing](https://docs.medusajs.com/resources/commerce-modules/pricing/tax-inclusive-pricing)).
  - Admin pages under `src/admin/routes/settings` appear in the settings sidebar ([UI routes](https://docs.medusajs.com/learn/fundamentals/admin/ui-routes)).
  - Scheduled jobs live in `src/jobs` with a cron `schedule` ([Scheduled jobs](https://docs.medusajs.com/learn/fundamentals/scheduled-jobs)).
- **ADR 0001.** Informative amounts, such as the IGV breakdown, round half-up to two decimals.

## Decision

1. **One regime value with flags that depend on it** (proposed). Under Nuevo RUS every flag except cap tracking is forced off. Under regime B each flag is set on its own, so a step can be staged (for example regime B with facturas still off).

   | Flag | Nuevo RUS | Regime B | Enforced by |
   |---|---|---|---|
   | `regime` | `nrus` | `b` | — |
   | `facturas` | Off (forced) | On | sunat-billing rejects a factura request while off; the checkout receipt step offers boletas only |
   | `marketplace_suppliers` | Off (forced) | On | Procurement: availability ignores those offers and their purchases are rejected ([ADR 0007](0007-availability-mapping.md)) |
   | `apple_line_purchasable` | Off (forced, R9) | On, once prices and offers exist | Availability, row 1 (ADR 0007) |
   | `igv_breakdown` | Off (forced) | On | Order totals in the storefront, account and emails ("IGV incluido: S/ 38.12" on a S/ 249.90 total), rounded half-up (ADR 0001) |
   | `nrus_cap_tracking` | On (forced) | Off | Cap widget, cap job and alerts |
   | Medusa tax setup | Peru tax region without a default rate; prices tax-inclusive | Default rate 18%; prices tax-inclusive | Region and tax region data (point 2) |

2. **Medusa tax setup** (proposed).
   - Prices are tax-inclusive in both regimes, through a price preference for `pen`. Shelf prices stay the same at the switch. Under regime B, Medusa extracts the IGV from the price, so payable totals stay exact in céntimos (ADR 0001).
   - Under Nuevo RUS, the Peru tax region has no default rate. The expected result is no tax lines and totals equal to prices. Not verified; F3 spike. If a region without a rate does not compute zero, F3 compares a 0% rate (not documented) with turning "Automatic Taxes" off.
   - Under regime B, the default rate is 18%, named "IGV". Whether comprobantes must show the IPM separately: Not verified; the accountant confirms.
3. **Nuevo RUS cap tracking.**
   - The admin gets a cap widget and a Telegram alert at 80% (approved, #30).
   - What counts (proposed). Periods are calendar months and years in America/Lima. The accountant confirms what each measure includes; until then, the counts err high so the alert comes early:

     | Measure | Counts | Limit | 80% |
     |---|---|---|---|
     | Sales this month | Payments captured this month, shipping included. Refunds are shown apart, not subtracted | S/ 8,000 | S/ 6,400 |
     | Purchases this month | Supplier purchases dated this month, at their comprobante total in soles, freight and fees included | S/ 8,000 | S/ 6,400 |
     | Sales this year | Same as monthly sales, for the calendar year | S/ 96,000 | S/ 76,800 |
     | Purchases this year | Same as monthly purchases, for the calendar year | S/ 96,000 | S/ 76,800 |

   - Other business purchases, such as packaging, are recorded as supplier purchases without items, so they count (proposed).
   - The widget also shows **committed** purchases: the expected cost of procurement items still `pending`. They are shown, not counted (proposed).
   - The widget shows the four meters on a settings page, `src/admin/routes/settings/regime/page.tsx`, together with the current flags (proposed). A copy goes on the orders list; its widget zone name is verified in F3.
   - The alert (proposed):
     - A scheduled job, `nrus-cap-check`, runs every hour.
     - When a measure reaches 80% for the first time in its period, the job emits `nrus-cap.threshold-reached`.
     - A subscriber sends the Telegram alert through the existing n8n channel (#30).
     - An `NrusCapAlert` record in the sunat-billing module (T7) keeps each alert to once per measure, period and threshold.
   - Checkout does not stop at the cap (proposed). The alert is the guard; the owner decides.
4. **Where the flags live** (proposed). Typed configuration in backend code, `src/config/regime.ts`, like the storefront's `features.ts`.
   - Changing the regime is a reviewed commit with CI. The git history is the audit trail.
   - The backend validates the configuration at boot. A forced-off flag that is on under `nrus` stops the backend from starting.
   - The settings page above shows the values read-only.
   - The backend is the authority. The storefront keeps `features.factura` in its own repository. A mismatch fails safe: a factura the backend has not enabled is rejected.

   | Option | How it changes | Review and audit | Drift between apps or environments | Main risk |
   |---|---|---|---|---|
   | Code configuration (chosen) | Commit and deploy | Pull request, CI, git history | Low: one value per repository, checked at boot | A deploy is needed; acceptable for a planned switch |
   | Environment variables | Edit the host and restart | None | High: per environment and per app, typos read as off | A silent wrong value in production |
   | Settings model and admin page toggle | One click in the admin | Only what the model records | Low | One click changes a legal state; needs a model, migration, routes and cache |

5. **Switching from Nuevo RUS to regime B** (proposed). In this order:
   1. The accountant chooses RER or RMT and the effective month. The owner files the change with SUNAT. When the change takes effect is the accountant's call (not verified here).
   2. The factura path is ready in sunat-billing: series and issuance (SEE-SOL by hand, or Nubefact). The accountant checks the factura copy, as the storefront comment requires.
   3. The owner reviews prices. Under regime B the same shelf price contains 18% IGV, so net revenue per sale drops.
   4. In staging, the Peru tax region gets the 18% default rate. A test cart keeps its total, shows the extracted IGV, and rounds the breakdown half-up.
   5. The owner exports the Nuevo RUS figures of the last month and year for the accountant.
   6. In the effective month, before its first order: the backend commit sets `regime: "b"` and the flags, and it is deployed. The production tax region gets the 18% rate right after.
   7. The storefront commit sets `factura: true` and is deployed after the backend. The storefront never offers a factura the backend would reject.
   8. The owner activates marketplace suppliers and their offers.
   9. The owner adds Apple prices, offers or stock, then turns `apple_line_purchasable` on. This can be a later commit.
   10. The owner updates legal pages that say "boletas only".
   11. One boleta order and one factura order run end to end in staging. The first production orders of each kind are checked by hand.

   A factura is never enabled before the regime change takes effect. Under Nuevo RUS, one factura moves the business into another regime from that month (art. 16.2).

## Consequences

- An illegal combination, such as facturas under Nuevo RUS, cannot reach production: the backend refuses to boot.
- The switch is two reviewed commits plus tax data in the admin. There is no runtime toggle to click by mistake.
- Orders placed before the switch keep their boletas. Procurement items bought under Nuevo RUS keep their records.
- Required tests:
  - Boot validation for each forced-off flag.
  - Each gate: facturas, marketplace offers and purchases, the Apple line, the IGV breakdown.
  - Cap sums at the Lima month boundary: a payment captured at 23:30 on the 31st in Lima is 04:30 UTC on the 1st, and counts for the month of the 31st.
  - One alert per threshold and period, also when the job runs twice.
- F3 spikes: a tax region without a rate, tax-inclusive extraction with 18%, the orders list widget zone.
- Questions for the accountant: what counts as gross income and purchases; refunds; whether the IPM shows on comprobantes; when the regime change takes effect.

## Alternatives considered

- **Environment variables.** Rejected: no review and no history. Values drift between environments and apps. It also contradicts the convention the storefront already follows.
- **Settings model in a custom module with an admin page toggle.** Rejected for now: one click would change a legal state, and it needs a model, a migration, routes and caching. The switch is planned months ahead, so a deploy is no burden. Revisit if a flag must change without a deploy.
- **Medusa custom feature flags.** Rejected: they are meant for features still in development, and turning one off requires rolling back its migrations.
- **Independent flags without a regime value.** Rejected: they allow illegal combinations, such as facturas under Nuevo RUS.
- **Tax-exclusive prices under regime B.** Rejected: every shelf price would change at the switch, and added tax could leave payable totals with fractions of a céntimo (ADR 0001).
- **Stop checkout automatically near the cap.** Rejected for now: it blocks sales on a conservative estimate. Tradeoff: one month above S/ 8,000 takes the business out of Nuevo RUS (art. 3.1), so the owner must act on the alert.
