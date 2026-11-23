import {
  readValue,
  sheetValueIssues,
  specValueIssue,
  toValueColumns,
} from "../domain/spec-value"

const EMPTY = {
  number_value: null,
  text_value: null,
  boolean_value: null,
  list_value: null,
}

describe("specValueIssue", () => {
  it.each([0, 1.24, -3, 13.6])(
    "accepts the finite number %p for a number spec",
    (value) => {
      expect(specValueIssue(value, "number")).toBeNull()
    },
  )

  it.each([
    [Number.NaN, "Expected a finite number, got null"],
    [Number.POSITIVE_INFINITY, "Expected a finite number, got null"],
    ["65", 'Expected a finite number, got "65"'],
    [null, "Expected a finite number, got null"],
    [true, "Expected a finite number, got true"],
  ])("refuses %p for a number spec", (value, issue) => {
    expect(specValueIssue(value, "number")).toBe(issue)
  })

  it("accepts non-blank text for a text spec", () => {
    expect(specValueIssue("USB-C", "text")).toBeNull()
  })

  it.each([
    ["", 'Expected non-blank text, got ""'],
    ["  ", 'Expected non-blank text, got "  "'],
    [5, "Expected non-blank text, got 5"],
    [["a"], 'Expected non-blank text, got ["a"]'],
  ])("refuses %p for a text spec", (value, issue) => {
    expect(specValueIssue(value, "text")).toBe(issue)
  })

  it.each([true, false])("accepts %p for a boolean spec", (value) => {
    expect(specValueIssue(value, "boolean")).toBeNull()
  })

  it.each([
    ["true", 'Expected a boolean, got "true"'],
    [0, "Expected a boolean, got 0"],
    [null, "Expected a boolean, got null"],
  ])("refuses %p for a boolean spec", (value, issue) => {
    expect(specValueIssue(value, "boolean")).toBe(issue)
  })

  it("accepts a list of distinct non-blank texts for a list spec", () => {
    expect(specValueIssue(["PD 3.0", "QC 4+"], "list")).toBeNull()
  })

  it.each([
    [[], "Expected a list of distinct non-blank texts, got []"],
    [
      ["PD", "PD"],
      'Expected a list of distinct non-blank texts, got ["PD","PD"]',
    ],
    [
      ["PD", " "],
      'Expected a list of distinct non-blank texts, got ["PD"," "]',
    ],
    [["PD", 3], 'Expected a list of distinct non-blank texts, got ["PD",3]'],
    ["PD", 'Expected a list of distinct non-blank texts, got "PD"'],
  ])("refuses %p for a list spec", (value, issue) => {
    expect(specValueIssue(value, "list")).toBe(issue)
  })
})

describe("toValueColumns", () => {
  it("puts each kind in its own column and leaves the others null", () => {
    expect(toValueColumns("number", 1.24)).toEqual({
      ...EMPTY,
      number_value: 1.24,
    })
    expect(toValueColumns("text", "USB-C")).toEqual({
      ...EMPTY,
      text_value: "USB-C",
    })
    expect(toValueColumns("boolean", false)).toEqual({
      ...EMPTY,
      boolean_value: false,
    })
    expect(toValueColumns("list", ["PD", "QC"])).toEqual({
      ...EMPTY,
      list_value: ["PD", "QC"],
    })
  })
})

describe("readValue", () => {
  it("reads the column of the definition's kind", () => {
    expect(readValue("number", { ...EMPTY, number_value: 65 })).toBe(65)
    expect(readValue("text", { ...EMPTY, text_value: "USB-C" })).toBe("USB-C")
    expect(readValue("boolean", { ...EMPTY, boolean_value: false })).toBe(false)
    expect(readValue("list", { ...EMPTY, list_value: ["PD"] })).toEqual(["PD"])
  })

  it("returns null when the kind's column is empty", () => {
    expect(readValue("number", { ...EMPTY, text_value: "65" })).toBeNull()
  })
})

describe("sheetValueIssues", () => {
  const definitions = [
    { key: "maxPower", kind: "number" as const },
    { key: "connector", kind: "text" as const },
    { key: "foldable", kind: "boolean" as const },
    { key: "protocols", kind: "list" as const },
  ]

  it("accepts values that fit their definitions, omitting any spec", () => {
    expect(
      sheetValueIssues(
        { maxPower: 65, foldable: true, protocols: ["PD"] },
        definitions,
      ),
    ).toEqual([])
    expect(sheetValueIssues({}, definitions)).toEqual([])
  })

  it("reports keys outside the schema and values of the wrong kind", () => {
    expect(
      sheetValueIssues(
        { maxPower: "65", color: "Negro", connector: "" },
        definitions,
      ),
    ).toEqual([
      'Spec "maxPower": Expected a finite number, got "65"',
      'Spec "color" is not in the spec schema',
      'Spec "connector": Expected non-blank text, got ""',
    ])
  })
})
