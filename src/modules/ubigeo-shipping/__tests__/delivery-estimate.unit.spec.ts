import { estimateDelivery } from "../domain/delivery-estimate"
import { UbigeoShippingRuleError } from "../domain/errors"

describe("estimateDelivery", () => {
  it("counts transit business days from the Lima date of the order", () => {
    // Friday 2026-10-02, 20:00 in Lima.
    expect(
      estimateDelivery(
        {
          placedAt: new Date("2026-10-03T01:00:00Z"),
          transit: { min: 1, max: 2 },
          leadTimeDays: null,
        },
        [],
      ),
    ).toEqual({
      transitDays: { min: 1, max: 2 },
      leadTimeDays: null,
      deliveryDays: { min: 1, max: 2 },
      from: "2026-10-05",
      to: "2026-10-06",
    })
  })

  it("adds the lead time minimum to the transit minimum and the maximums together", () => {
    // Monday 2026-10-05, 10:00 in Lima: 3+2 = 5 and 5+4 = 9 business days.
    expect(
      estimateDelivery(
        {
          placedAt: new Date("2026-10-05T15:00:00Z"),
          transit: { min: 3, max: 5 },
          leadTimeDays: { min: 2, max: 4 },
        },
        [],
      ),
    ).toEqual({
      transitDays: { min: 3, max: 5 },
      leadTimeDays: { min: 2, max: 4 },
      deliveryDays: { min: 5, max: 9 },
      from: "2026-10-12",
      to: "2026-10-16",
    })
  })

  it("skips holidays in both dates", () => {
    // Monday 2026-07-27 in Lima; Fiestas Patrias on Tuesday 28 and Wednesday 29.
    const quote = estimateDelivery(
      {
        placedAt: new Date("2026-07-27T15:00:00Z"),
        transit: { min: 1, max: 2 },
        leadTimeDays: null,
      },
      ["2026-07-28", "2026-07-29"],
    )
    expect(quote.from).toBe("2026-07-30")
    expect(quote.to).toBe("2026-07-31")
  })

  it("uses the next Lima date from 05:00 UTC, not from UTC midnight", () => {
    const input = { transit: { min: 1, max: 1 }, leadTimeDays: null }
    // 23:59 on Thursday 2026-10-01 in Lima: next business day is Friday.
    expect(
      estimateDelivery(
        { ...input, placedAt: new Date("2026-10-02T04:59:59Z") },
        [],
      ).from,
    ).toBe("2026-10-02")
    // 00:00 on Friday 2026-10-02 in Lima: next business day is Monday.
    expect(
      estimateDelivery(
        { ...input, placedAt: new Date("2026-10-02T05:00:00Z") },
        [],
      ).from,
    ).toBe("2026-10-05")
  })

  it("accepts the placement instant as an ISO string", () => {
    expect(
      estimateDelivery(
        {
          placedAt: "2026-10-03T01:00:00.000Z",
          transit: { min: 1, max: 2 },
          leadTimeDays: null,
        },
        [],
      ).from,
    ).toBe("2026-10-05")
  })

  it("rejects day ranges that are negative, fractional or inverted", () => {
    const placedAt = new Date("2026-10-05T15:00:00Z")
    const invalidRanges = [
      { min: -1, max: 2 },
      { min: 1, max: 2.5 },
      { min: 3, max: 2 },
    ]
    for (const range of invalidRanges) {
      expect(() =>
        estimateDelivery({ placedAt, transit: range, leadTimeDays: null }, []),
      ).toThrow(UbigeoShippingRuleError)
      expect(() =>
        estimateDelivery(
          { placedAt, transit: { min: 1, max: 2 }, leadTimeDays: range },
          [],
        ),
      ).toThrow(UbigeoShippingRuleError)
    }
  })

  it("rejects an invalid placement instant", () => {
    expect(() =>
      estimateDelivery(
        {
          placedAt: "yesterday",
          transit: { min: 1, max: 2 },
          leadTimeDays: null,
        },
        [],
      ),
    ).toThrow(UbigeoShippingRuleError)
  })
})
