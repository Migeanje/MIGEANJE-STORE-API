import { addBusinessDays, limaDate } from "../domain/calendar"
import { UbigeoShippingRuleError } from "../domain/errors"

describe("limaDate", () => {
  it("is the calendar date in America/Lima (UTC-5, no daylight saving)", () => {
    expect(limaDate(new Date("2026-10-03T15:00:00Z"))).toBe("2026-10-03")
    // 02:00 UTC is still the evening before in Lima.
    expect(limaDate(new Date("2026-10-03T02:00:00Z"))).toBe("2026-10-02")
  })

  it("changes day at Lima midnight, 05:00 UTC", () => {
    expect(limaDate(new Date("2026-10-03T04:59:59.999Z"))).toBe("2026-10-02")
    expect(limaDate(new Date("2026-10-03T05:00:00.000Z"))).toBe("2026-10-03")
  })

  it("keeps the old year until Lima midnight on new year's eve", () => {
    expect(limaDate(new Date("2027-01-01T04:59:59.999Z"))).toBe("2026-12-31")
    expect(limaDate(new Date("2027-01-01T05:00:00.000Z"))).toBe("2027-01-01")
  })

  it("rejects an invalid instant", () => {
    expect(() => limaDate(new Date("not a date"))).toThrow(
      UbigeoShippingRuleError,
    )
  })
})

describe("addBusinessDays", () => {
  const noHolidays: string[] = []

  it("skips Saturdays and Sundays", () => {
    // 2026-10-02 is a Friday.
    expect(addBusinessDays("2026-10-02", 1, noHolidays)).toBe("2026-10-05")
    expect(addBusinessDays("2026-10-02", 2, noHolidays)).toBe("2026-10-06")
    expect(addBusinessDays("2026-10-05", 5, noHolidays)).toBe("2026-10-12")
  })

  it("starts counting on the next business day from a weekend", () => {
    // 2026-10-03 is a Saturday.
    expect(addBusinessDays("2026-10-03", 1, noHolidays)).toBe("2026-10-05")
  })

  it("returns the same date for zero days, even on a weekend or holiday", () => {
    expect(addBusinessDays("2026-10-03", 0, noHolidays)).toBe("2026-10-03")
    expect(addBusinessDays("2026-07-28", 0, ["2026-07-28"])).toBe("2026-07-28")
  })

  it("crosses months and years", () => {
    expect(addBusinessDays("2026-10-30", 1, noHolidays)).toBe("2026-11-02")
    expect(addBusinessDays("2026-12-31", 1, noHolidays)).toBe("2027-01-01")
  })

  it("skips a holiday on a weekday", () => {
    // 2026-12-08 (Inmaculada Concepción) is a Tuesday.
    expect(addBusinessDays("2026-12-07", 1, ["2026-12-08"])).toBe("2026-12-09")
  })

  it("skips consecutive holidays", () => {
    // Fiestas Patrias 2026: Tuesday 28 and Wednesday 29 of July.
    const fiestasPatrias = ["2026-07-28", "2026-07-29"]
    expect(addBusinessDays("2026-07-27", 1, fiestasPatrias)).toBe("2026-07-30")
    expect(addBusinessDays("2026-07-27", 2, fiestasPatrias)).toBe("2026-07-31")
  })

  it("skips a Friday holiday and the weekend after it", () => {
    // Christmas 2026 is a Friday.
    expect(addBusinessDays("2026-12-24", 1, ["2026-12-25"])).toBe("2026-12-28")
  })

  it("skips a new year's day holiday across the year end", () => {
    // 2026-12-31 is a Thursday; 2027-01-01 is a Friday.
    expect(addBusinessDays("2026-12-31", 1, ["2027-01-01"])).toBe("2027-01-04")
  })

  it("counts nothing extra for a holiday on a weekend", () => {
    // Santa Rosa de Lima 2026 is a Sunday; 2026-08-28 is a Friday.
    expect(addBusinessDays("2026-08-28", 1, ["2026-08-30"])).toBe("2026-08-31")
  })

  it("ignores holidays on or before the start date", () => {
    expect(addBusinessDays("2026-07-28", 1, ["2026-07-27", "2026-07-28"])).toBe(
      "2026-07-29",
    )
  })

  it("rejects days that are not a non-negative integer", () => {
    for (const days of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => addBusinessDays("2026-10-02", days, noHolidays)).toThrow(
        UbigeoShippingRuleError,
      )
    }
  })

  it("rejects a date that is not a real YYYY-MM-DD calendar date", () => {
    for (const date of [
      "03/10/2026",
      "2026-10-3",
      "2026-02-30",
      "2026-13-01",
    ]) {
      expect(() => addBusinessDays(date, 1, noHolidays)).toThrow(
        UbigeoShippingRuleError,
      )
    }
  })
})
