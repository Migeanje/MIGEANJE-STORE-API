import { resolveSpecs } from "../domain/resolve-specs"
import type { StoredDefinition, StoredValue } from "../domain/stored"

const definition = (
  id: string,
  rank: number,
  kind: StoredDefinition["kind"],
): StoredDefinition => ({
  id,
  key: id,
  label: `Label ${id}`,
  unit: null,
  kind,
  filterable: false,
  comparable: true,
  rank,
})

const value = (
  definition_id: string,
  columns: Partial<StoredValue>,
): StoredValue => ({
  sheet_id: "specsheet_1",
  definition_id,
  number_value: null,
  text_value: null,
  boolean_value: null,
  list_value: null,
  ...columns,
})

describe("resolveSpecs", () => {
  const definitions = [
    definition("weight", 2, "number"),
    definition("connector", 0, "text"),
    definition("foldable", 1, "boolean"),
    definition("protocols", 3, "list"),
  ]

  it("returns the present values with their definitions in rank order", () => {
    expect(
      resolveSpecs(definitions, [
        value("protocols", { list_value: ["PD"] }),
        value("weight", { number_value: 1.24 }),
        value("connector", { text_value: "USB-C" }),
      ]),
    ).toEqual([
      {
        definition_id: "connector",
        key: "connector",
        label: "Label connector",
        unit: null,
        kind: "text",
        filterable: false,
        comparable: true,
        rank: 0,
        value: "USB-C",
      },
      {
        definition_id: "weight",
        key: "weight",
        label: "Label weight",
        unit: null,
        kind: "number",
        filterable: false,
        comparable: true,
        rank: 2,
        value: 1.24,
      },
      {
        definition_id: "protocols",
        key: "protocols",
        label: "Label protocols",
        unit: null,
        kind: "list",
        filterable: false,
        comparable: true,
        rank: 3,
        value: ["PD"],
      },
    ])
  })

  it("keeps a false boolean, which is a present value", () => {
    expect(
      resolveSpecs(definitions, [
        value("foldable", { boolean_value: false }),
      ]).map((spec) => spec.value),
    ).toEqual([false])
  })

  it("leaves out values of definitions outside the list", () => {
    expect(
      resolveSpecs(definitions, [value("color", { text_value: "Negro" })]),
    ).toEqual([])
  })

  it("does not reorder the definitions it is given", () => {
    resolveSpecs(definitions, [])
    expect(definitions.map((d) => d.rank)).toEqual([2, 0, 1, 3])
  })
})
