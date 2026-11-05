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
| [0007](adr/0007-availability-mapping.md) | Availability: Medusa inventory plus procurement offers, enforced on the server (proposed) |
| [0008](adr/0008-regime-flags.md) | Regime flags: one typed regime setting, from Nuevo RUS to regime B (proposed) |

## State machines

| Machine | Covers |
|---|---|
| [Order](state-machines/order.md) | The status customers see, from `pagado` to `entregado`, `cancelado` or `reembolsado` |
| [Complaint](state-machines/complaint.md) | A Hoja de Reclamación from `filed` to `answered`, with derived conditions such as `overdue` (proposed) |
| [Procurement item](state-machines/procurement-item.md) | The purchase of one backorder line, from `pending` to `received` or `canceled` (proposed) |

## Data model

[Data model](data-model/README.md): the custom modules, their models and their module links (proposed).

## Seed plan

[Seed plan](seed-plan.md): what the seed script loads from the storefront fixtures, in which order, and how the Apple line stays non-purchasable (proposed).

## Coming in F2

- Contract map from storefront ports to Medusa endpoints.
