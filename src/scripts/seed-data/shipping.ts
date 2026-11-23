// Generated once from the storefront fixture modules/checkout/domain/shipping.ts (SHIPPING_RATES, DRAFT, R10)
// (MIGEANJE-STORE-APP/src); see docs/seed-plan.md, "Data sources".

import type { SeedShippingRate } from "./types"

/** DRAFT rates and transit days; the owner edits them in the admin. */
export const SHIPPING_RATES: SeedShippingRate[] = [
  {
    zone: "lima_metro",
    costCentimos: 1000,
    transitDays: {
      min: 1,
      max: 2,
    },
  },
  {
    zone: "callao",
    costCentimos: 1200,
    transitDays: {
      min: 1,
      max: 2,
    },
  },
  {
    zone: "rest_of_peru",
    costCentimos: 2000,
    transitDays: {
      min: 3,
      max: 5,
    },
  },
]
