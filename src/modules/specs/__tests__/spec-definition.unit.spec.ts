import {
  definitionChangeIssue,
  definitionDeletionIssue,
  definitionIssues,
  duplicateDefinitionIssues,
  type SpecDefinitionFields,
  withDefinitionDefaults,
} from "../domain/spec-definition"

const maxPower: SpecDefinitionFields = {
  key: "maxPower",
  label: "Potencia máxima",
  unit: "W",
  kind: "number",
  filterable: true,
  comparable: true,
  rank: 0,
}

describe("withDefinitionDefaults", () => {
  it("fills unit, filterable and comparable with their defaults", () => {
    expect(
      withDefinitionDefaults({
        key: "ports",
        label: "Puertos",
        kind: "list",
        rank: 2,
      }),
    ).toEqual({
      key: "ports",
      label: "Puertos",
      unit: null,
      kind: "list",
      filterable: false,
      comparable: true,
      rank: 2,
    })
  })

  it("keeps the values it is given", () => {
    expect(withDefinitionDefaults(maxPower)).toEqual(maxPower)
  })
})

describe("definitionIssues", () => {
  it("accepts a valid definition", () => {
    expect(definitionIssues(maxPower)).toEqual([])
  })

  it.each(["MaxPower", "max_power", "max-power", "1power", "", "máxima"])(
    "refuses the key %p because it is not camelCase",
    (key) => {
      expect(definitionIssues({ ...maxPower, key })).toEqual([
        `Spec key "${key}" must be camelCase, e.g. "maxPower"`,
      ])
    },
  )

  it.each(["", "   "])("refuses the blank label %p", (label) => {
    expect(definitionIssues({ ...maxPower, label })).toEqual([
      'Spec "maxPower" needs a label',
    ])
  })

  it.each(["text", "boolean", "list"] as const)(
    "refuses a unit on a %s spec",
    (kind) => {
      expect(definitionIssues({ ...maxPower, kind })).toEqual([
        'Spec "maxPower" has a unit but is not a number',
      ])
    },
  )

  it("accepts a spec of any kind without a unit", () => {
    for (const kind of ["number", "text", "boolean", "list"] as const) {
      expect(definitionIssues({ ...maxPower, kind, unit: null })).toEqual([])
    }
  })

  it("refuses an unknown kind", () => {
    expect(
      definitionIssues({
        ...maxPower,
        unit: null,
        kind: "date" as SpecDefinitionFields["kind"],
      }),
    ).toEqual(['Spec "maxPower" has an unknown kind "date"'])
  })

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses the rank %p",
    (rank) => {
      expect(definitionIssues({ ...maxPower, rank })).toEqual([
        'Spec "maxPower" needs a rank that is a whole number of 0 or more',
      ])
    },
  )

  it("reports every issue at once", () => {
    expect(
      definitionIssues({
        ...maxPower,
        key: "Max",
        label: "",
        kind: "text",
        rank: -2,
      }),
    ).toEqual([
      'Spec key "Max" must be camelCase, e.g. "maxPower"',
      'Spec "Max" needs a label',
      'Spec "Max" has a unit but is not a number',
      'Spec "Max" needs a rank that is a whole number of 0 or more',
    ])
  })
})

describe("duplicateDefinitionIssues", () => {
  it("accepts definitions with distinct keys, labels and ranks", () => {
    expect(
      duplicateDefinitionIssues([
        maxPower,
        { ...maxPower, key: "weight", label: "Peso", rank: 1 },
      ]),
    ).toEqual([])
  })

  it("reports a repeated key, label and rank once each", () => {
    expect(
      duplicateDefinitionIssues([
        maxPower,
        { ...maxPower },
        { ...maxPower, key: "weight", label: "Peso", rank: 1 },
      ]),
    ).toEqual([
      'Spec key "maxPower" is defined twice',
      'Spec label "Potencia máxima" is defined twice',
      "Spec rank 0 is used twice",
    ])
  })
})

describe("definitionChangeIssue", () => {
  const current = { ...maxPower, schema_id: "specsch_1" }

  it("allows changing the label, unit, flags and rank", () => {
    expect(
      definitionChangeIssue(
        current,
        {
          ...current,
          label: "Potencia",
          unit: "kW",
          filterable: false,
          comparable: false,
          rank: 4,
        },
        3,
      ),
    ).toBeNull()
  })

  it.each([0, 3])("refuses a new key with %p values", (valueCount) => {
    expect(
      definitionChangeIssue(current, { ...current, key: "power" }, valueCount),
    ).toBe('Spec key "maxPower" cannot change')
  })

  it("refuses moving the spec to another schema", () => {
    expect(
      definitionChangeIssue(current, { ...current, schema_id: "specsch_2" }, 0),
    ).toBe('Spec "maxPower" cannot move to another spec schema')
  })

  it("refuses a new kind while values exist", () => {
    expect(
      definitionChangeIssue(
        current,
        { ...current, kind: "text", unit: null },
        2,
      ),
    ).toBe(
      'Spec "maxPower" has values in 2 products, so its kind cannot change',
    )
  })

  it("allows a new kind when no value exists", () => {
    expect(
      definitionChangeIssue(
        current,
        { ...current, kind: "text", unit: null },
        0,
      ),
    ).toBeNull()
  })
})

describe("definitionDeletionIssue", () => {
  it("allows deleting a spec without values when others remain", () => {
    expect(
      definitionDeletionIssue({
        key: "maxPower",
        definitionCount: 2,
        valueCount: 0,
      }),
    ).toBeNull()
  })

  it("refuses deleting the last spec of a schema", () => {
    expect(
      definitionDeletionIssue({
        key: "maxPower",
        definitionCount: 1,
        valueCount: 0,
      }),
    ).toBe(
      'Spec "maxPower" is the last one of its spec schema, which needs at least one',
    )
  })

  it("refuses deleting a spec with values", () => {
    expect(
      definitionDeletionIssue({
        key: "maxPower",
        definitionCount: 3,
        valueCount: 1,
      }),
    ).toBe('Spec "maxPower" has values in 1 product; remove them first')
  })
})
