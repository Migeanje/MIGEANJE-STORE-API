import { computeFacets } from "../domain/facets"
import type { StoredDefinition, StoredValue } from "../domain/stored"

const definition = (
  fields: Partial<StoredDefinition> &
    Pick<StoredDefinition, "id" | "kind" | "rank">,
): StoredDefinition => ({
  key: fields.id,
  label: `Label ${fields.id}`,
  unit: null,
  filterable: true,
  comparable: true,
  ...fields,
})

const value = (
  sheet_id: string,
  definition_id: string,
  columns: Partial<StoredValue>,
): StoredValue => ({
  sheet_id,
  definition_id,
  number_value: null,
  text_value: null,
  boolean_value: null,
  list_value: null,
  ...columns,
})

describe("computeFacets", () => {
  const maxPower = definition({
    id: "maxPower",
    kind: "number",
    rank: 3,
    unit: "W",
  })
  const weight = definition({ id: "weight", kind: "number", rank: 4 })
  const connector = definition({ id: "connector", kind: "text", rank: 1 })
  const protocols = definition({ id: "protocols", kind: "list", rank: 2 })
  const foldable = definition({ id: "foldable", kind: "boolean", rank: 0 })

  it("builds one facet per filterable definition, in rank order", () => {
    const facets = computeFacets(
      [maxPower, weight, connector, protocols, foldable],
      [
        value("s1", "maxPower", { number_value: 65 }),
        value("s2", "maxPower", { number_value: 20 }),
        value("s3", "maxPower", { number_value: 140 }),
        value("s1", "weight", { number_value: 1.24 }),
        value("s1", "connector", { text_value: "USB-C" }),
        value("s2", "connector", { text_value: "Lightning" }),
        value("s3", "connector", { text_value: "USB-C" }),
        value("s1", "protocols", { list_value: ["QC 4+", "PD 3.0"] }),
        value("s2", "protocols", { list_value: ["PD 3.0"] }),
        value("s1", "foldable", { boolean_value: true }),
        value("s2", "foldable", { boolean_value: false }),
        value("s3", "foldable", { boolean_value: true }),
      ],
    )

    expect(facets).toEqual([
      { kind: "toggle", key: "foldable", label: "Label foldable", count: 2 },
      {
        kind: "options",
        key: "connector",
        label: "Label connector",
        options: [
          { value: "Lightning", count: 1 },
          { value: "USB-C", count: 2 },
        ],
      },
      {
        kind: "options",
        key: "protocols",
        label: "Label protocols",
        options: [
          { value: "PD 3.0", count: 2 },
          { value: "QC 4+", count: 1 },
        ],
      },
      {
        kind: "range",
        key: "maxPower",
        label: "Label maxPower",
        unit: "W",
        min: 20,
        max: 140,
      },
      {
        kind: "range",
        key: "weight",
        label: "Label weight",
        min: 1.24,
        max: 1.24,
      },
    ])
  })

  it("leaves out definitions that are not filterable", () => {
    expect(
      computeFacets(
        [{ ...connector, filterable: false }],
        [value("s1", "connector", { text_value: "USB-C" })],
      ),
    ).toEqual([])
  })

  it("leaves out facets no product can match", () => {
    expect(
      computeFacets(
        [maxPower, connector, protocols, foldable],
        [value("s1", "foldable", { boolean_value: false })],
      ),
    ).toEqual([])
  })

  it("sorts options as people read them: accents and numbers", () => {
    const facets = computeFacets(
      [connector],
      [
        value("s1", "connector", { text_value: "USB 10" }),
        value("s2", "connector", { text_value: "USB 2" }),
        value("s3", "connector", { text_value: "Óptico" }),
        value("s4", "connector", { text_value: "Ethernet" }),
      ],
    )
    expect(
      facets.flatMap((facet) =>
        facet.kind === "options" ? facet.options.map((o) => o.value) : [],
      ),
    ).toEqual(["Ethernet", "Óptico", "USB 2", "USB 10"])
  })

  it("ignores values of definitions it was not given", () => {
    expect(
      computeFacets(
        [connector],
        [value("s1", "color", { text_value: "Negro" })],
      ),
    ).toEqual([])
  })
})
