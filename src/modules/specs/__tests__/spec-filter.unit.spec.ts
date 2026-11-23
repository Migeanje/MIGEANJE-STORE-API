import { activeFilters, filterIssues } from "../domain/spec-filter"

const definitions = [
  { id: "specdef_power", key: "maxPower", kind: "number" as const },
  { id: "specdef_connector", key: "connector", kind: "text" as const },
  { id: "specdef_foldable", key: "foldable", kind: "boolean" as const },
  { id: "specdef_protocols", key: "protocols", kind: "list" as const },
]

describe("filterIssues", () => {
  it("accepts one filter of the right kind per spec", () => {
    expect(
      filterIssues(
        {
          maxPower: { kind: "range", min: 20, max: 65 },
          connector: { kind: "options", values: ["USB-C"] },
          foldable: { kind: "toggle" },
          protocols: { kind: "options", values: ["PD 3.0"] },
        },
        definitions,
      ),
    ).toEqual([])
  })

  it("reports keys outside the schema and filters of the wrong kind", () => {
    expect(
      filterIssues(
        {
          color: { kind: "options", values: ["Negro"] },
          maxPower: { kind: "options", values: ["65"] },
          foldable: { kind: "range", min: 1 },
        },
        definitions,
      ),
    ).toEqual([
      'Spec "color" is not in the spec schema',
      'Spec "maxPower" is a number spec and takes a "range" filter, got "options"',
      'Spec "foldable" is a boolean spec and takes a "toggle" filter, got "range"',
    ])
  })

  it("reports non-finite range bounds and non-text options", () => {
    expect(
      filterIssues(
        {
          maxPower: { kind: "range", min: Number.NaN },
          connector: {
            kind: "options",
            values: [3] as unknown as string[],
          },
        },
        definitions,
      ),
    ).toEqual([
      'Spec "maxPower" has a range bound that is not a finite number',
      'Spec "connector" has an option that is not text',
    ])
  })
})

describe("activeFilters", () => {
  it("pairs each non-empty filter with its definition", () => {
    expect(
      activeFilters(
        {
          maxPower: { kind: "range", max: 65 },
          connector: { kind: "options", values: [] },
          foldable: { kind: "toggle" },
          protocols: { kind: "options", values: ["PD 3.0"] },
        },
        definitions,
      ),
    ).toEqual([
      { definition: definitions[0], filter: { kind: "range", max: 65 } },
      { definition: definitions[2], filter: { kind: "toggle" } },
      {
        definition: definitions[3],
        filter: { kind: "options", values: ["PD 3.0"] },
      },
    ])
  })

  it("drops a range without bounds, as F1 does", () => {
    expect(activeFilters({ maxPower: { kind: "range" } }, definitions)).toEqual(
      [],
    )
  })
})
