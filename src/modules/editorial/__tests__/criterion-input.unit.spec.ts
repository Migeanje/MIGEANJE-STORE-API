import {
  findCriterionConflicts,
  validateCriterionInput,
  validateRubricCriteria,
} from "../domain/criterion-input"

describe("validateCriterionInput", () => {
  it("accepts a criterion and trims its name", () => {
    expect(
      validateCriterionInput({ name: " Relación precio-calidad ", rank: 0 }),
    ).toEqual({ ok: true, value: { name: "Relación precio-calidad", rank: 0 } })
  })

  it("rejects a blank name", () => {
    expect(validateCriterionInput({ name: "  ", rank: 1 })).toEqual({
      ok: false,
      issues: ["name must not be blank"],
    })
  })

  it.each([-1, 1.5, Number.NaN])("rejects the rank %p", (rank) => {
    expect(validateCriterionInput({ name: "Potencia", rank })).toEqual({
      ok: false,
      issues: ["rank must be an integer of 0 or more"],
    })
  })
})

describe("validateRubricCriteria", () => {
  it("accepts a list of criteria and trims every name", () => {
    expect(
      validateRubricCriteria([
        { name: "Potencia ", rank: 0 },
        { name: "Portabilidad", rank: 1 },
      ]),
    ).toEqual({
      ok: true,
      value: [
        { name: "Potencia", rank: 0 },
        { name: "Portabilidad", rank: 1 },
      ],
    })
  })

  it("requires at least one criterion", () => {
    expect(validateRubricCriteria([])).toEqual({
      ok: false,
      issues: ["A rubric needs at least one criterion"],
    })
  })

  it("reports invalid criteria by position", () => {
    expect(
      validateRubricCriteria([
        { name: "Potencia", rank: 0 },
        { name: "", rank: -2 },
      ]),
    ).toEqual({
      ok: false,
      issues: [
        "criteria[1].name must not be blank",
        "criteria[1].rank must be an integer of 0 or more",
      ],
    })
  })

  it("rejects a repeated name, compared after trimming", () => {
    expect(
      validateRubricCriteria([
        { name: "Potencia", rank: 0 },
        { name: " Potencia", rank: 1 },
      ]),
    ).toEqual({
      ok: false,
      issues: ['Criterion name "Potencia" is used twice'],
    })
  })

  it("rejects a repeated rank", () => {
    expect(
      validateRubricCriteria([
        { name: "Potencia", rank: 2 },
        { name: "Portabilidad", rank: 2 },
      ]),
    ).toEqual({ ok: false, issues: ["Criterion rank 2 is used twice"] })
  })
})

describe("findCriterionConflicts", () => {
  const others = [
    { name: "Potencia", rank: 0 },
    { name: "Portabilidad", rank: 1 },
  ]

  it("finds no conflict for a free name and rank", () => {
    expect(
      findCriterionConflicts({ name: "Capacidad", rank: 2 }, others),
    ).toEqual([])
  })

  it("reports a name and a rank that another criterion holds", () => {
    expect(
      findCriterionConflicts({ name: "Potencia", rank: 1 }, others),
    ).toEqual([
      'The rubric already has a criterion named "Potencia"',
      "The rubric already has a criterion at rank 1",
    ])
  })
})
