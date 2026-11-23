import { MedusaError } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { ensureTestDatabase } from "../../../../integration-tests/support/ensure-test-database"
import { SPECS_MODULE } from ".."
import ProductSpecSheet from "../models/product-spec-sheet"
import SpecDefinition from "../models/spec-definition"
import SpecSchema from "../models/spec-schema"
import SpecValue from "../models/spec-value"
import type SpecsModuleService from "../service"
import type { SpecDefinitionInput } from "../types"

jest.setTimeout(60 * 1000)

ensureTestDatabase(SPECS_MODULE)

const CHARGER_SPECS: SpecDefinitionInput[] = [
  {
    key: "maxPower",
    label: "Potencia máxima",
    unit: "W",
    kind: "number",
    filterable: true,
    rank: 0,
  },
  {
    key: "connector",
    label: "Conector",
    kind: "text",
    filterable: true,
    rank: 1,
  },
  {
    key: "protocols",
    label: "Protocolos de carga",
    kind: "list",
    filterable: true,
    rank: 2,
  },
  {
    key: "foldable",
    label: "Enchufe plegable",
    kind: "boolean",
    filterable: true,
    rank: 3,
  },
  { key: "weight", label: "Peso", unit: "kg", kind: "number", rank: 4 },
]

moduleIntegrationTestRunner<SpecsModuleService>({
  moduleName: SPECS_MODULE,
  resolve: "./src/modules/specs",
  moduleModels: [SpecSchema, SpecDefinition, ProductSpecSheet, SpecValue],
  testSuite: ({ service }) => {
    const definitionOf = async (schemaId: string, key: string) => {
      const { definitions } = await service.getSchema(schemaId)
      const definition = definitions.find((d) => d.key === key)
      if (!definition) throw new Error(`No definition ${key}`)
      return definition
    }

    describe("upsertSheet", () => {
      it("creates a sheet and stores each value in its typed column", async () => {
        const schema = await service.createSchema(CHARGER_SPECS)

        const sheet = await service.upsertSheet(null, schema.id, {
          weight: 1.24,
          protocols: ["PD 3.0", "QC 4+"],
          foldable: false,
          connector: "USB-C",
        })

        expect(sheet.id).toMatch(/^specsheet_/)
        expect(sheet.schema_id).toBe(schema.id)
        expect(sheet.specs.map(({ key, value }) => [key, value])).toEqual([
          ["connector", "USB-C"],
          ["protocols", ["PD 3.0", "QC 4+"]],
          ["foldable", false],
          ["weight", 1.24],
        ])
        const stored = await service.listSpecValues(
          { sheet_id: sheet.id },
          { order: { text_value: "ASC" } },
        )
        expect(stored).toHaveLength(4)
        expect(stored[0]).toMatchObject({
          definition_id: (await definitionOf(schema.id, "connector")).id,
          number_value: null,
          text_value: "USB-C",
          boolean_value: null,
          list_value: null,
        })
      })

      it("replaces the values of an existing sheet", async () => {
        const schema = await service.createSchema(CHARGER_SPECS)
        const { id } = await service.upsertSheet(null, schema.id, {
          maxPower: 65,
          connector: "USB-C",
        })

        const sheet = await service.upsertSheet(id, schema.id, {
          maxPower: 100,
          foldable: true,
        })

        expect(sheet.id).toBe(id)
        expect(sheet.specs.map(({ key, value }) => [key, value])).toEqual([
          ["maxPower", 100],
          ["foldable", true],
        ])
        expect(await service.listSpecValues({ sheet_id: id })).toHaveLength(2)
        expect(await service.listProductSpecSheets({})).toHaveLength(1)
      })

      it("allows a sheet that omits every spec", async () => {
        const schema = await service.createSchema(CHARGER_SPECS)
        const { id } = await service.upsertSheet(null, schema.id, {
          maxPower: 65,
        })

        const sheet = await service.upsertSheet(id, schema.id, {})

        expect(sheet.specs).toEqual([])
        expect(await service.listSpecValues({ sheet_id: id })).toEqual([])
      })

      it("refuses values that do not fit their definitions, changing nothing", async () => {
        const schema = await service.createSchema(CHARGER_SPECS)
        const { id } = await service.upsertSheet(null, schema.id, {
          maxPower: 65,
        })

        await expect(
          service.upsertSheet(id, schema.id, {
            maxPower: Number.POSITIVE_INFINITY,
            connector: " ",
            protocols: ["PD", "PD"],
            foldable: "yes",
            color: "Negro",
          } as never),
        ).rejects.toMatchObject({
          type: MedusaError.Types.INVALID_DATA,
          message: [
            'Spec "maxPower": Expected a finite number, got null',
            'Spec "connector": Expected non-blank text, got " "',
            'Spec "protocols": Expected a list of distinct non-blank texts, got ["PD","PD"]',
            'Spec "foldable": Expected a boolean, got "yes"',
            'Spec "color" is not in the spec schema',
          ].join("; "),
        })
        const stored = await service.listSpecValues({ sheet_id: id })
        expect(stored).toHaveLength(1)
        expect(stored[0].number_value).toBe(65)
        expect(await service.listProductSpecSheets({})).toHaveLength(1)
      })

      it("moves the sheet to the schema it was written with", async () => {
        const chargers = await service.createSchema(CHARGER_SPECS)
        const cables = await service.createSchema([
          { key: "length", label: "Largo", unit: "m", kind: "number", rank: 0 },
        ])
        const { id } = await service.upsertSheet(null, chargers.id, {
          maxPower: 65,
        })

        const sheet = await service.upsertSheet(id, cables.id, { length: 2 })

        expect(sheet).toMatchObject({ id, schema_id: cables.id })
        expect(sheet.specs.map(({ key }) => key)).toEqual(["length"])
        expect(await service.listSpecValues({ sheet_id: id })).toHaveLength(1)
      })

      it("throws NOT_FOUND for an unknown sheet or schema", async () => {
        const schema = await service.createSchema(CHARGER_SPECS)

        await expect(
          service.upsertSheet("specsheet_missing", schema.id, {}),
        ).rejects.toMatchObject({ type: MedusaError.Types.NOT_FOUND })
        await expect(
          service.upsertSheet(null, "specsch_missing", {}),
        ).rejects.toMatchObject({ type: MedusaError.Types.NOT_FOUND })
        expect(await service.listProductSpecSheets({})).toEqual([])
      })
    })

    describe("listResolvedSpecs", () => {
      it("returns each sheet's present values with their definitions, in rank order", async () => {
        const chargers = await service.createSchema(CHARGER_SPECS)
        const cables = await service.createSchema([
          { key: "length", label: "Largo", unit: "m", kind: "number", rank: 0 },
        ])
        const charger = await service.upsertSheet(null, chargers.id, {
          weight: 0.12,
          maxPower: 65,
        })
        const cable = await service.upsertSheet(null, cables.id, { length: 2 })
        const empty = await service.upsertSheet(null, chargers.id, {})

        const resolved = await service.listResolvedSpecs([
          cable.id,
          "specsheet_missing",
          charger.id,
          empty.id,
        ])

        expect(resolved).toEqual([
          {
            id: cable.id,
            schema_id: cables.id,
            specs: [
              {
                definition_id: (await definitionOf(cables.id, "length")).id,
                key: "length",
                label: "Largo",
                unit: "m",
                kind: "number",
                filterable: false,
                comparable: true,
                rank: 0,
                value: 2,
              },
            ],
          },
          {
            id: charger.id,
            schema_id: chargers.id,
            specs: [
              expect.objectContaining({ key: "maxPower", value: 65 }),
              expect.objectContaining({ key: "weight", value: 0.12 }),
            ],
          },
          { id: empty.id, schema_id: chargers.id, specs: [] },
        ])
      })

      it("returns nothing for no sheets", async () => {
        expect(await service.listResolvedSpecs([])).toEqual([])
      })
    })

    describe("computeFacets", () => {
      it("counts only the given sheets, one facet per filterable spec", async () => {
        const schema = await service.createSchema(CHARGER_SPECS)
        const a = await service.upsertSheet(null, schema.id, {
          maxPower: 65,
          connector: "USB-C",
          protocols: ["PD 3.0", "QC 4+"],
          foldable: true,
          weight: 0.12,
        })
        const b = await service.upsertSheet(null, schema.id, {
          maxPower: 20,
          connector: "Lightning",
          protocols: ["PD 3.0"],
          foldable: false,
        })
        const draft = await service.upsertSheet(null, schema.id, {
          maxPower: 240,
          connector: "Ethernet",
        })

        const facets = await service.computeFacets(schema.id, [a.id, b.id])

        expect(facets).toEqual([
          {
            kind: "range",
            key: "maxPower",
            label: "Potencia máxima",
            unit: "W",
            min: 20,
            max: 65,
          },
          {
            kind: "options",
            key: "connector",
            label: "Conector",
            options: [
              { value: "Lightning", count: 1 },
              { value: "USB-C", count: 1 },
            ],
          },
          {
            kind: "options",
            key: "protocols",
            label: "Protocolos de carga",
            options: [
              { value: "PD 3.0", count: 2 },
              { value: "QC 4+", count: 1 },
            ],
          },
          {
            kind: "toggle",
            key: "foldable",
            label: "Enchufe plegable",
            count: 1,
          },
        ])
        expect(
          await service.computeFacets(schema.id, [draft.id]),
        ).toMatchObject([
          { key: "maxPower", min: 240, max: 240 },
          { key: "connector", options: [{ value: "Ethernet", count: 1 }] },
        ])
      })

      it("returns no facets for no sheets", async () => {
        const schema = await service.createSchema(CHARGER_SPECS)

        expect(await service.computeFacets(schema.id, [])).toEqual([])
      })

      it("throws NOT_FOUND for an unknown schema", async () => {
        await expect(
          service.computeFacets("specsch_missing", []),
        ).rejects.toMatchObject({ type: MedusaError.Types.NOT_FOUND })
      })
    })

    describe("matchSheets", () => {
      const setup = async () => {
        const schema = await service.createSchema(CHARGER_SPECS)
        const light = await service.upsertSheet(null, schema.id, {
          maxPower: 20,
          connector: "Lightning",
          protocols: ["PD 3.0"],
          weight: 1.24,
        })
        const usbC = await service.upsertSheet(null, schema.id, {
          maxPower: 65,
          connector: "USB-C",
          protocols: ["PD 3.0", "QC 4+"],
          foldable: true,
          weight: 13.6,
        })
        const gan = await service.upsertSheet(null, schema.id, {
          maxPower: 140,
          connector: "USB-C",
          protocols: ["PPS"],
          foldable: false,
        })
        const other = await service.createSchema(CHARGER_SPECS)
        const foreign = await service.upsertSheet(null, other.id, {
          maxPower: 65,
        })
        return { schema, light, usbC, gan, foreign }
      }

      it("matches a range with inclusive bounds on number_value", async () => {
        const { schema, light, usbC, gan } = await setup()

        expect(
          await service.matchSheets(schema.id, {
            maxPower: { kind: "range", min: 20, max: 65 },
          }),
        ).toEqual(expect.arrayContaining([light.id, usbC.id]))
        expect(
          await service.matchSheets(schema.id, {
            maxPower: { kind: "range", min: 66 },
          }),
        ).toEqual([gan.id])
        expect(
          await service.matchSheets(schema.id, {
            maxPower: { kind: "range", max: 19.5 },
          }),
        ).toEqual([])
      })

      it("keeps decimal values inside bounds equal to them", async () => {
        const { schema, light, usbC } = await setup()

        expect(
          await service.matchSheets(schema.id, {
            weight: { kind: "range", min: 1.24, max: 1.24 },
          }),
        ).toEqual([light.id])
        expect(
          await service.matchSheets(schema.id, {
            weight: { kind: "range", min: 13.6, max: 13.6 },
          }),
        ).toEqual([usbC.id])
      })

      it("matches text options with $in", async () => {
        const { schema, light, usbC, gan } = await setup()

        const ids = await service.matchSheets(schema.id, {
          connector: { kind: "options", values: ["USB-C", "Ethernet"] },
        })
        expect(ids.sort()).toEqual([usbC.id, gan.id].sort())
        expect(ids).not.toContain(light.id)
      })

      it("matches list options when any item overlaps", async () => {
        const { schema, light, usbC, gan } = await setup()

        const ids = await service.matchSheets(schema.id, {
          protocols: { kind: "options", values: ["QC 4+", "PPS"] },
        })
        expect(ids.sort()).toEqual([usbC.id, gan.id].sort())
        expect(
          await service.matchSheets(schema.id, {
            protocols: { kind: "options", values: ["PD 3.0"] },
          }),
        ).toEqual(expect.arrayContaining([light.id, usbC.id]))
      })

      it("matches a toggle only when the value is true", async () => {
        const { schema, usbC } = await setup()

        expect(
          await service.matchSheets(schema.id, {
            foldable: { kind: "toggle" },
          }),
        ).toEqual([usbC.id])
      })

      it("combines filters with AND and ignores empty selections", async () => {
        const { schema, gan } = await setup()

        expect(
          await service.matchSheets(schema.id, {
            connector: { kind: "options", values: ["USB-C"] },
            maxPower: { kind: "range", min: 100 },
            protocols: { kind: "options", values: [] },
            weight: { kind: "range" },
          }),
        ).toEqual([gan.id])
      })

      it("returns every sheet of the schema without filters, never another schema's", async () => {
        const { schema, light, usbC, gan, foreign } = await setup()

        const ids = await service.matchSheets(schema.id, {})

        expect(ids.sort()).toEqual([light.id, usbC.id, gan.id].sort())
        expect(ids).not.toContain(foreign.id)
      })

      it("searches only the given sheets, keeping their order", async () => {
        const { schema, light, usbC, gan, foreign } = await setup()

        expect(
          await service.matchSheets(schema.id, {}, [
            gan.id,
            foreign.id,
            light.id,
          ]),
        ).toEqual([gan.id, light.id])
        expect(
          await service.matchSheets(
            schema.id,
            { connector: { kind: "options", values: ["USB-C"] } },
            [usbC.id, light.id],
          ),
        ).toEqual([usbC.id])
        expect(await service.matchSheets(schema.id, {}, [])).toEqual([])
      })

      it("refuses filters the schema cannot apply", async () => {
        const { schema } = await setup()

        await expect(
          service.matchSheets(schema.id, {
            color: { kind: "options", values: ["Negro"] },
            maxPower: { kind: "toggle" },
          }),
        ).rejects.toMatchObject({
          type: MedusaError.Types.INVALID_DATA,
          message:
            'Spec "color" is not in the spec schema; Spec "maxPower" is a number spec and takes a "range" filter, got "toggle"',
        })
      })

      it("throws NOT_FOUND for an unknown schema", async () => {
        await expect(
          service.matchSheets("specsch_missing", {}),
        ).rejects.toMatchObject({ type: MedusaError.Types.NOT_FOUND })
      })
    })
  },
})
