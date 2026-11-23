import { type ReviewInput, validateReviewInput } from "../domain/review-input"

const validInput = (): ReviewInput => ({
  verdict: "El cargador más versátil por su precio.",
  for_whom: ["Quien carga laptop y celular a la vez", "Quien viaja"],
  not_for: ["Quien solo carga un celular"],
  scores: [
    { criterion_id: "rvcrit_power", score: 5, note: "100 W reales." },
    { criterion_id: "rvcrit_ports", score: 4, note: "Tres puertos." },
  ],
})

const issuesOf = (input: ReviewInput): string[] => {
  const result = validateReviewInput(input)
  expect(result.ok).toBe(false)
  return result.ok ? [] : result.issues
}

describe("validateReviewInput", () => {
  it("accepts a valid review and keeps the order of every list", () => {
    const result = validateReviewInput(validInput())

    expect(result).toEqual({ ok: true, value: validInput() })
  })

  it("trims every text, as F1 textSchema does", () => {
    const result = validateReviewInput({
      verdict: "  Buen cargador.  ",
      for_whom: [" Quien viaja "],
      not_for: ["\tQuien no tiene laptop\n"],
      scores: [{ criterion_id: " rvcrit_power ", score: 3, note: " Bien. " }],
    })

    expect(result).toEqual({
      ok: true,
      value: {
        verdict: "Buen cargador.",
        for_whom: ["Quien viaja"],
        not_for: ["Quien no tiene laptop"],
        scores: [{ criterion_id: "rvcrit_power", score: 3, note: "Bien." }],
      },
    })
  })

  it("rejects a blank verdict", () => {
    expect(issuesOf({ ...validInput(), verdict: "   " })).toEqual([
      "verdict must not be blank",
    ])
  })

  it("accepts a verdict of exactly 240 characters after trimming", () => {
    const verdict = "a".repeat(240)

    const result = validateReviewInput({
      ...validInput(),
      verdict: ` ${verdict} `,
    })

    expect(result).toEqual({ ok: true, value: { ...validInput(), verdict } })
  })

  it("rejects a verdict longer than 240 characters", () => {
    expect(issuesOf({ ...validInput(), verdict: "a".repeat(241) })).toEqual([
      "verdict must be at most 240 characters",
    ])
  })

  it("requires at least one for_whom item and rejects blank ones", () => {
    expect(issuesOf({ ...validInput(), for_whom: [] })).toEqual([
      "for_whom needs at least one item",
    ])
    expect(
      issuesOf({ ...validInput(), for_whom: ["Quien viaja", " "] }),
    ).toEqual(["for_whom[1] must not be blank"])
  })

  it("requires at least one not_for item and rejects blank ones", () => {
    expect(issuesOf({ ...validInput(), not_for: [] })).toEqual([
      "not_for needs at least one item",
    ])
    expect(issuesOf({ ...validInput(), not_for: [""] })).toEqual([
      "not_for[0] must not be blank",
    ])
  })

  it("requires at least one score", () => {
    expect(issuesOf({ ...validInput(), scores: [] })).toEqual([
      "scores needs at least one item",
    ])
  })

  it("accepts the score bounds 1 and 5", () => {
    const scores = [
      { criterion_id: "rvcrit_power", score: 1, note: "Poca." },
      { criterion_id: "rvcrit_ports", score: 5, note: "Muchos." },
    ]

    expect(validateReviewInput({ ...validInput(), scores })).toEqual({
      ok: true,
      value: { ...validInput(), scores },
    })
  })

  it.each([0, 6, 3.5, Number.NaN])("rejects the score %p", (score) => {
    const scores = [{ criterion_id: "rvcrit_power", score, note: "Nota." }]

    expect(issuesOf({ ...validInput(), scores })).toEqual([
      "scores[0].score must be an integer from 1 to 5",
    ])
  })

  it("rejects a score with a blank criterion or a blank note", () => {
    const scores = [
      { criterion_id: "rvcrit_power", score: 4, note: "Bien." },
      { criterion_id: " ", score: 4, note: "  " },
    ]

    expect(issuesOf({ ...validInput(), scores })).toEqual([
      "scores[1].criterion_id must not be blank",
      "scores[1].note must not be blank",
    ])
  })

  it("rejects a criterion scored twice, with F1's message", () => {
    const scores = [
      { criterion_id: "rvcrit_power", score: 4, note: "Bien." },
      { criterion_id: "rvcrit_power", score: 2, note: "Otra vez." },
    ]

    expect(issuesOf({ ...validInput(), scores })).toEqual([
      'Rubric criterion "rvcrit_power" is used twice',
    ])
  })

  it("reports every issue at once", () => {
    expect(
      issuesOf({ verdict: "", for_whom: [], not_for: [], scores: [] }),
    ).toEqual([
      "verdict must not be blank",
      "for_whom needs at least one item",
      "not_for needs at least one item",
      "scores needs at least one item",
    ])
  })
})
