# Documentation

Design of the Migeanje Store backend. Phase F2 produces these documents before Medusa is installed in F3.

## Architecture decision records

Cross-cutting decisions. Storefront-only decisions live in the storefront repository's `docs/adr/`.

| ADR | Decision |
|---|---|
| [0001](adr/0001-money-representation.md) | Money: integer céntimos with currency in the storefront, big numbers in Medusa |
| [0002](adr/0002-order-number.md) | Order number: a formatting of Medusa's `display_id` |
| [0003](adr/0003-order-status-projection.md) | Order status: a projection of order, payment, fulfillment and procurement |
| [0004](adr/0004-customer-auth.md) | Customer auth: Medusa owns identity, the storefront holds a Medusa session |
| [0005](adr/0005-culqi-payments.md) | Payments: Culqi tokenization and a Medusa payment provider (proposed) |
| [0006](adr/0006-complaints-book.md) | Complaints book: a custom module with a gapless yearly correlative (proposed) |

## State machines

| Machine | Covers |
|---|---|
| [Order](state-machines/order.md) | The status customers see, from `pagado` to `entregado`, `cancelado` or `reembolsado` |
| [Complaint](state-machines/complaint.md) | A Hoja de Reclamación from `filed` to `answered`, with derived conditions such as `overdue` (proposed) |

## Coming in F2

- Availability mapping and regime flags ADRs.
- Data model of each custom module and its module links.
- Contract map from storefront ports to Medusa endpoints.
- State machine for procurement item.
- Seed plan from the storefront fixtures.
