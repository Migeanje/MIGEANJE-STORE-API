import { centimosToMajor } from "../money"

describe("centimosToMajor", () => {
  it.each([
    [0, 0],
    [5, 0.05],
    [100, 1],
    [1000, 10],
    [18990, 189.9],
    [24890, 248.9],
    [349990, 3499.9],
    [649890, 6498.9],
  ])("converts %i céntimos to %d major units", (centimos, major) => {
    expect(centimosToMajor(centimos)).toBe(major)
  })

  it("is exact where a float division is not", () => {
    // A float round trip drifts (1.15 * 100 is 114.99999999999999); decimal
    // parsing does not.
    expect(centimosToMajor(115)).toBe(1.15)
    expect(centimosToMajor(435)).toBe(4.35)
    expect(centimosToMajor(1005)).toBe(10.05)
  })

  it("fails on a fraction of a céntimo", () => {
    expect(() => centimosToMajor(189.5)).toThrow(/whole number of céntimos/)
    expect(() => centimosToMajor(0.1)).toThrow(/whole number of céntimos/)
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
    "fails on %d",
    (value) => {
      expect(() => centimosToMajor(value)).toThrow(/céntimos/)
    },
  )
})
