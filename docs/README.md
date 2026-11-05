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

## State machines

| Machine | Covers |
|---|---|
| [Order](state-machines/order.md) | The status customers see, from `pagado` to `entregado`, `cancelado` or `reembolsado` |

## Coming in F2

- Culqi tokenization, complaints, availability mapping and regime flags ADRs.
- Data model of each custom module and its module links.
- Contract map from storefront ports to Medusa endpoints.
- State machines for procurement item and complaint.
- Seed plan from the storefront fixtures.
