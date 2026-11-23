import { UbigeoShippingRuleError } from "./errors"

/*
 * The business-day calendar of delivery estimates. Dates are Lima calendar
 * dates ("2026-10-05"); instants stay UTC. Business days are Monday to Friday
 * minus the holidays of the `holiday` table (decision D11). The complaints
 * deadline counts holidays as business days and never calls this calendar.
 */

export const LIMA_TIME_ZONE = "America/Lima"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

const limaDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: LIMA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** The calendar date in Lima of an instant, e.g. "2026-10-03". */
export function limaDate(instant: Date): string {
  if (Number.isNaN(instant.getTime())) {
    throw new UbigeoShippingRuleError("Expected a valid instant")
  }
  const parts: Record<string, string> = {}
  for (const { type, value } of limaDateFormat.formatToParts(instant)) {
    parts[type] = value
  }
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** Midnight UTC of a YYYY-MM-DD date; throws for anything else. */
function parseCalendarDate(date: string): Date {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (
    !DATE_PATTERN.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    formatCalendarDate(parsed) !== date
  ) {
    throw new UbigeoShippingRuleError(
      `Expected a calendar date as YYYY-MM-DD, got "${date}"`,
    )
  }
  return parsed
}

function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Throws unless `date` is a real calendar date written as YYYY-MM-DD. */
export function assertCalendarDate(date: string): void {
  parseCalendarDate(date)
}

/** Throws unless `days` is a non-negative safe integer. */
export function assertDayCount(days: number, label = "Business days"): void {
  if (!Number.isSafeInteger(days) || days < 0) {
    throw new UbigeoShippingRuleError(
      `${label} must be a non-negative integer, got ${days}`,
    )
  }
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

/**
 * The date `days` business days after `date`, skipping Saturdays, Sundays and
 * `holidays` (YYYY-MM-DD). The start date itself never counts, so zero days
 * returns it unchanged.
 */
export function addBusinessDays(
  date: string,
  days: number,
  holidays: Iterable<string>,
): string {
  assertDayCount(days)
  const skipped = new Set(holidays)
  let current = parseCalendarDate(date)
  let left = days
  while (left > 0) {
    current = new Date(current.getTime() + DAY_MS)
    if (!isWeekend(current) && !skipped.has(formatCalendarDate(current))) {
      left -= 1
    }
  }
  return formatCalendarDate(current)
}
