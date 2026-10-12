# ADR 0001 — Money: integer céntimos with currency in the storefront, big numbers in Medusa

- Status: Accepted
- Date: 2026-10-12
- Deciders: Owner
- Related: Engram #18 (6.3, 6.9), #118 (R2, R8), #121

## Context

- The F1 storefront models money as a non-negative integer of céntimos without a currency. The type is defined twice (`catalog/domain/money.ts` and `cart/domain/cart.ts`). That breaks planning decision 6.9: money always carries its currency, and nothing hardcodes `S/` or `PEN`.
- Medusa v2 stores amounts in **major units** as big numbers. A `model.bigNumber()` property adds a `raw_<field>` column with the exact decimal value as a string (`{ "value": "10.99", "precision": 20 }`), arithmetic uses `MathBN`, and API responses return amounts as plain JSON numbers. Currency codes are lowercase ISO 4217 (`pen`). Sources: [Big numbers](https://docs.medusajs.com/learn/fundamentals/data-models/big-numbers), [Pricing concepts](https://docs.medusajs.com/resources/commerce-modules/pricing/concepts).
- Culqi charges and refunds take `amount` as an integer of céntimos and `currency_code` as `PEN` or `USD` ([Culqi API spec](https://apidocs.culqi.com/apiculqi.yaml)).
- Medusa computes derived amounts that can carry more than two decimals: the tax inside a tax-inclusive price (IGV in regime B), or percentage promotions.

## Decision

1. **Storefront type.** `Money = { amountCents: number; currency: CurrencyCode }`, where `amountCents` is a non-negative safe integer and `CurrencyCode = "PEN"` (ISO 4217, uppercase). There is one definition in the storefront's shared domain. It replaces both F1 copies (R8). Widening `CurrencyCode` is the multi-currency switch.
2. **Backend representation.** Medusa core keeps its own big numbers. Custom modules store money as `model.bigNumber()` in major units plus a `currency_code` text column in lowercase, following the Medusa convention. Money is never stored as a float (`model.float()`) and never as minor units in the backend (decision 6.3).
3. **Two conversion boundaries, both written test-first.**
   - The storefront's Medusa adapter (anti-corruption layer) converts Medusa amounts to `Money`. It normalizes the currency to uppercase.
   - The Culqi payment provider in Medusa converts the amount to charge or refund into integer céntimos for the Culqi API.
   - Both read the minor-unit exponent from a currency table (`PEN: 2`). Both parse the decimal representation of the amount instead of multiplying a float (in JavaScript, `1.1 * 100` is `110.00000000000001`).
4. **Payable amounts are strict.** Variant prices, line totals, shipping, discounts, cart and order totals, payment amounts and refund amounts must be exact in céntimos. If one of them carries a fraction of a céntimo, the converter throws. The adapter logs a structured event and the customer sees a generic error. A rounded amount is never charged, because it would differ from the payment Medusa recorded and break reconciliation silently.
5. **Informative amounts are rounded.** Amounts that are shown but never charged (the IGV breakdown) are rounded half-up to two decimals.
6. **Formatting.** The UI formats with `Intl.NumberFormat("es-PE", { style: "currency", currency })` using the currency of the value. The symbol and currency are never hardcoded.
7. **Exchange rates.** Any currency conversion, such as supplier costs in USD for margins, stores a snapshot `{ rate, source, capturedAt }` next to the converted amount. The rate is a big number, never a float. The procurement data model defines the fields.

## Consequences

- Storefront arithmetic stays on integers; the UI never does float math with money.
- Required tests for both converters: exact amounts, a payable amount with three decimals (throws), informative rounding at the half (`0.005` rounds up), amounts near `Number.MAX_SAFE_INTEGER`, and currency casing.
- A percentage promotion that produces fractions of a céntimo blocks checkout loudly. The MVP has no promotions. Any future promotion must be configured so payable totals stay exact.
- Adding USD later means widening `CurrencyCode` and configuring a Medusa region with its prices. The type does not change.
- Storefront follow-up (F4): replace both `moneySchema` copies and `assertMinorUnits` with the shared type, and add `currency` to the fixtures.
