import { addBusinessDays, assertDayCount, limaDate } from "./calendar"
import { UbigeoShippingRuleError } from "./errors"

/** A range of business days, e.g. 1 to 2. */
export type DayRange = { min: number; max: number }

export type DeliveryEstimateInput = {
  /** When the order was placed: a Date or an ISO 8601 instant. */
  placedAt: Date | string
  /** The courier's time for the chosen shipping option. */
  transit: DayRange
  /** The longest backorder lead time of the order, or null without one. */
  leadTimeDays: DayRange | null
}

export type DeliveryQuote = {
  transitDays: DayRange
  leadTimeDays: DayRange | null
  /** Transit plus lead time, in business days. */
  deliveryDays: DayRange
  /** First and last delivery dates in Lima (YYYY-MM-DD). */
  from: string
  to: string
}

function assertDayRange(range: DayRange, label: string): void {
  assertDayCount(range.min, `${label} minimum`)
  assertDayCount(range.max, `${label} maximum`)
  if (range.max < range.min) {
    throw new UbigeoShippingRuleError(
      `${label} maximum (${range.max}) is below its minimum (${range.min})`,
    )
  }
}

/**
 * Delivery days (transit plus lead time) and the delivery dates of an order:
 * business days counted from the Lima date of `placedAt`, skipping weekends
 * and `holidays` (F1 `quoteShipping` plus `deliveryWindow`).
 */
export function estimateDelivery(
  input: DeliveryEstimateInput,
  holidays: Iterable<string>,
): DeliveryQuote {
  assertDayRange(input.transit, "Transit")
  if (input.leadTimeDays) assertDayRange(input.leadTimeDays, "Lead time")

  const start = limaDate(new Date(input.placedAt))
  const deliveryDays = {
    min: input.transit.min + (input.leadTimeDays?.min ?? 0),
    max: input.transit.max + (input.leadTimeDays?.max ?? 0),
  }
  const skipped = [...holidays]
  return {
    transitDays: { ...input.transit },
    leadTimeDays: input.leadTimeDays ? { ...input.leadTimeDays } : null,
    deliveryDays,
    from: addBusinessDays(start, deliveryDays.min, skipped),
    to: addBusinessDays(start, deliveryDays.max, skipped),
  }
}

/** The Lima date an order placed at `placedAt` counts from. */
export function placementDate(placedAt: Date | string): string {
  return limaDate(new Date(placedAt))
}
