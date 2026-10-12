# Documentation

Design of the Migeanje Store backend. Phase F2 produces these documents before Medusa is installed in F3.

## Architecture decision records

Cross-cutting decisions. Storefront-only decisions live in the storefront repository's `docs/adr/`.

| ADR | Decision |
|---|---|
| [0001](adr/0001-money-representation.md) | Money: integer céntimos with currency in the storefront, big numbers in Medusa |

## Coming in F2

- Order number, order status projection, auth, Culqi tokenization, complaints, availability mapping and regime flags ADRs.
- Data model of each custom module and its module links.
- Contract map from storefront ports to Medusa endpoints.
- State machines for order, procurement item and complaint.
- Seed plan from the storefront fixtures.
