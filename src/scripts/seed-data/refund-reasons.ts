import type { SeedRefundReason } from "./types"

/** ADR 0005, decision 11. */
export const REFUND_REASONS: SeedRefundReason[] = [
  { code: "customer_request", label: "Pedido del cliente" },
  { code: "order_canceled", label: "Pedido cancelado" },
  { code: "return", label: "Devolución" },
  { code: "duplicate", label: "Cobro duplicado" },
  { code: "fraud", label: "Fraude" },
]
