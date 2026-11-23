import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { ensureTestDatabase } from "../../../../integration-tests/support/ensure-test-database"
import { SPECS_MODULE } from ".."
import ProductSpecSheet from "../models/product-spec-sheet"
import SpecDefinition from "../models/spec-definition"
import SpecSchema from "../models/spec-schema"
import SpecValue from "../models/spec-value"
import type SpecsModuleService from "../service"

jest.setTimeout(60 * 1000)

ensureTestDatabase(SPECS_MODULE)

// The database guards of docs/data-model/specs.md, exercised through the
// generated CRUD methods, which skip the service rules on purpose. Check
// violations are matched by constraint name: the server message is localized.
moduleIntegrationTestRunner<SpecsModuleService>({
  moduleName: SPECS_MODULE,
  resolve: "./src/modules/specs",
  moduleModels: [SpecSchema, SpecDefinition, ProductSpecSheet, SpecValue],
  testSuite: ({ service }) => {
    const definitionData = (schema_id: string) => ({
      schema_id,
      key: "maxPower",
      label: "Potencia máxima",
      unit: "W",
      kind: "number" as const,
      rank: 0,
    })

    describe("IDs and defaults", () => {
      it("uses the page's ID prefixes", async () => {
        const schema = await service.createSpecSchemas({})
        const definition = await service.createSpecDefinitions(
          definitionData(schema.id),
        )
        const sheet = await service.createProductSpecSheets({
          schema_id: schema.id,
        })
        const value = await service.createSpecValues({
          sheet_id: sheet.id,
          definition_id: definition.id,
          number_value: 65,
        })

        expect(schema.id).toMatch(/^specsch_/)
        expect(definition.id).toMatch(/^specdef_/)
        expect(sheet.id).toMatch(/^specsheet_/)
        expect(value.id).toMatch(/^specval_/)
      })

      it("defaults unit to null, filterable to false and comparable to true", async () => {
        const schema = await service.createSpecSchemas({})
        const definition = await service.createSpecDefinitions({
          schema_id: schema.id,
          key: "connector",
          label: "Conector",
          kind: "text",
          rank: 0,
        })

        expect(definition).toMatchObject({
          unit: null,
          filterable: false,
          comparable: true,
        })
      })
    })

    describe("spec_definition checks", () => {
      it.each([
        [
          "a key that is not camelCase",
          { key: "max_power" },
          "spec_definition_key_format",
        ],
        ["a blank label", { label: "  " }, "spec_definition_label_not_blank"],
        [
          "a unit on a text spec",
          { kind: "text" as const },
          "spec_definition_unit_only_for_numbers",
        ],
        ["a negative rank", { rank: -1 }, "spec_definition_rank_not_negative"],
      ])("refuses %s", async (_case, change, constraint) => {
        const schema = await service.createSpecSchemas({})

        await expect(
          service.createSpecDefinitions({
            ...definitionData(schema.id),
            ...change,
          }),
        ).rejects.toThrow(constraint)
        expect(await service.listSpecDefinitions({})).toEqual([])
      })

      it("refuses a kind outside number, text, boolean and list", async () => {
        const schema = await service.createSpecSchemas({})

        await expect(
          service.createSpecDefinitions({
            ...definitionData(schema.id),
            unit: null,
            kind: "date" as "text",
          }),
        ).rejects.toThrow()
        expect(await service.listSpecDefinitions({})).toEqual([])
      })
    })

    describe("spec_definition uniqueness per schema", () => {
      it.each([
        ["key", { label: "Otra", rank: 1 }],
        ["label", { key: "other", rank: 1 }],
        ["rank", { key: "other", label: "Otra" }],
      ])(
        "refuses a second definition with the same %s",
        async (_field, change) => {
          const schema = await service.createSpecSchemas({})
          await service.createSpecDefinitions(definitionData(schema.id))

          await expect(
            service.createSpecDefinitions({
              ...definitionData(schema.id),
              ...change,
            }),
          ).rejects.toThrow(/already exists/)
          expect(await service.listSpecDefinitions({})).toHaveLength(1)
        },
      )

      it("allows the same key, label and rank in another schema", async () => {
        const [first, second] = await service.createSpecSchemas([{}, {}])
        await service.createSpecDefinitions(definitionData(first.id))
        await service.createSpecDefinitions(definitionData(second.id))

        expect(await service.listSpecDefinitions({})).toHaveLength(2)
      })

      it("allows reusing them after a soft delete", async () => {
        const schema = await service.createSpecSchemas({})
        const old = await service.createSpecDefinitions(
          definitionData(schema.id),
        )
        await service.softDeleteSpecDefinitions([old.id])
        await service.createSpecDefinitions(definitionData(schema.id))

        expect(await service.listSpecDefinitions({})).toHaveLength(1)
      })
    })

    describe("spec_value", () => {
      const setup = async () => {
        const schema = await service.createSpecSchemas({})
        const definition = await service.createSpecDefinitions(
          definitionData(schema.id),
        )
        const sheet = await service.createProductSpecSheets({
          schema_id: schema.id,
        })
        return { sheet_id: sheet.id, definition_id: definition.id }
      }

      it("refuses a value with no column filled", async () => {
        const ids = await setup()

        await expect(service.createSpecValues(ids)).rejects.toThrow(
          "spec_value_exactly_one_column",
        )
        expect(await service.listSpecValues({})).toEqual([])
      })

      it("refuses a value with two columns filled", async () => {
        const ids = await setup()

        await expect(
          service.createSpecValues({
            ...ids,
            number_value: 65,
            text_value: "65",
          }),
        ).rejects.toThrow("spec_value_exactly_one_column")
        expect(await service.listSpecValues({})).toEqual([])
      })

      it("stores each kind in its typed column", async () => {
        const ids = await setup()
        const value = await service.createSpecValues({
          ...ids,
          list_value: ["PD 3.0", "QC 4+"],
        })

        const [stored] = await service.listSpecValues({ id: value.id })
        expect(stored).toMatchObject({
          number_value: null,
          text_value: null,
          boolean_value: null,
          list_value: ["PD 3.0", "QC 4+"],
        })
      })

      it("keeps the decimals of a number value", async () => {
        const ids = await setup()
        const value = await service.createSpecValues({
          ...ids,
          number_value: 13.6,
        })

        const [stored] = await service.listSpecValues({ id: value.id })
        expect(stored.number_value).toBe(13.6)
      })

      it("refuses a second value for the same definition in one sheet", async () => {
        const ids = await setup()
        await service.createSpecValues({ ...ids, number_value: 65 })

        await expect(
          service.createSpecValues({ ...ids, number_value: 20 }),
        ).rejects.toThrow(/already exists/)
        expect(await service.listSpecValues({})).toHaveLength(1)
      })
    })
  },
})
