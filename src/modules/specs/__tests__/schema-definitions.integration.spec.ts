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
  { key: "weight", label: "Peso", unit: "g", kind: "number", rank: 4 },
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
    comparable: false,
    rank: 1,
  },
]

moduleIntegrationTestRunner<SpecsModuleService>({
  moduleName: SPECS_MODULE,
  resolve: "./src/modules/specs",
  moduleModels: [SpecSchema, SpecDefinition, ProductSpecSheet, SpecValue],
  testSuite: ({ service }) => {
    describe("createSchema", () => {
      it("stores the schema with its definitions and returns them in rank order", async () => {
        const schema = await service.createSchema(CHARGER_SPECS)

        expect(schema.id).toMatch(/^specsch_/)
        expect(schema.definitions).toEqual([
          {
            id: expect.stringMatching(/^specdef_/),
            schema_id: schema.id,
            key: "maxPower",
            label: "Potencia máxima",
            unit: "W",
            kind: "number",
            filterable: true,
            comparable: true,
            rank: 0,
          },
          {
            id: expect.stringMatching(/^specdef_/),
            schema_id: schema.id,
            key: "connector",
            label: "Conector",
            unit: null,
            kind: "text",
            filterable: true,
            comparable: false,
            rank: 1,
          },
          {
            id: expect.stringMatching(/^specdef_/),
            schema_id: schema.id,
            key: "weight",
            label: "Peso",
            unit: "g",
            kind: "number",
            filterable: false,
            comparable: true,
            rank: 4,
          },
        ])
        expect(await service.listSpecSchemas({})).toHaveLength(1)
        expect(await service.listSpecDefinitions({})).toHaveLength(3)
      })

      it("refuses a schema without specs", async () => {
        await expect(service.createSchema([])).rejects.toMatchObject({
          type: MedusaError.Types.INVALID_DATA,
          message: "A spec schema needs at least one spec",
        })
        expect(await service.listSpecSchemas({})).toEqual([])
      })

      it("refuses invalid definitions, reporting every issue", async () => {
        await expect(
          service.createSchema([
            { key: "Max", label: "Potencia", kind: "number", rank: 0 },
            { key: "color", label: "Color", unit: "W", kind: "text", rank: 1 },
          ]),
        ).rejects.toMatchObject({
          type: MedusaError.Types.INVALID_DATA,
          message:
            'Spec key "Max" must be camelCase, e.g. "maxPower"; Spec "color" has a unit but is not a number',
        })
        expect(await service.listSpecSchemas({})).toEqual([])
        expect(await service.listSpecDefinitions({})).toEqual([])
      })

      it("refuses repeated keys, labels or ranks", async () => {
        await expect(
          service.createSchema([
            CHARGER_SPECS[0],
            { ...CHARGER_SPECS[0], key: "mass" },
          ]),
        ).rejects.toMatchObject({
          type: MedusaError.Types.DUPLICATE_ERROR,
          message:
            'Spec label "Peso" is defined twice; Spec rank 4 is used twice',
        })
        expect(await service.listSpecSchemas({})).toEqual([])
      })
    })

    describe("getSchema", () => {
      it("returns the definitions in rank order", async () => {
        const created = await service.createSchema(CHARGER_SPECS)

        const schema = await service.getSchema(created.id)

        expect(schema).toEqual(created)
        expect(schema.definitions.map((d) => d.key)).toEqual([
          "maxPower",
          "connector",
          "weight",
        ])
      })

      it("throws NOT_FOUND for an unknown schema", async () => {
        await expect(
          service.getSchema("specsch_missing"),
        ).rejects.toMatchObject({ type: MedusaError.Types.NOT_FOUND })
      })
    })

    describe("upsertDefinition", () => {
      it("adds a definition to a schema with the defaults", async () => {
        const { id } = await service.createSchema(CHARGER_SPECS)

        const definition = await service.upsertDefinition({
          schema_id: id,
          key: "foldable",
          label: "Enchufe plegable",
          kind: "boolean",
          rank: 2,
        })

        expect(definition).toEqual({
          id: expect.stringMatching(/^specdef_/),
          schema_id: id,
          key: "foldable",
          label: "Enchufe plegable",
          unit: null,
          kind: "boolean",
          filterable: false,
          comparable: true,
          rank: 2,
        })
        expect((await service.getSchema(id)).definitions).toHaveLength(4)
      })

      it.each([
        [
          "key",
          { key: "weight", label: "Masa", rank: 9 },
          'Spec key "weight" is defined twice',
        ],
        [
          "label",
          { key: "mass", label: "Peso", rank: 9 },
          'Spec label "Peso" is defined twice',
        ],
        [
          "rank",
          { key: "mass", label: "Masa", rank: 4 },
          "Spec rank 4 is used twice",
        ],
      ])(
        "refuses a %s already used in the schema",
        async (_field, change, message) => {
          const { id } = await service.createSchema(CHARGER_SPECS)

          await expect(
            service.upsertDefinition({
              schema_id: id,
              kind: "number",
              ...change,
            }),
          ).rejects.toMatchObject({
            type: MedusaError.Types.DUPLICATE_ERROR,
            message,
          })
          expect((await service.getSchema(id)).definitions).toHaveLength(3)
        },
      )

      it("refuses an invalid definition", async () => {
        const { id } = await service.createSchema(CHARGER_SPECS)

        await expect(
          service.upsertDefinition({
            schema_id: id,
            key: "max-power",
            label: "Otra",
            kind: "number",
            rank: 7,
          }),
        ).rejects.toMatchObject({
          type: MedusaError.Types.INVALID_DATA,
          message: 'Spec key "max-power" must be camelCase, e.g. "maxPower"',
        })
      })

      it("throws NOT_FOUND when adding to an unknown schema", async () => {
        await expect(
          service.upsertDefinition({
            schema_id: "specsch_missing",
            key: "weight",
            label: "Peso",
            kind: "number",
            rank: 0,
          }),
        ).rejects.toMatchObject({ type: MedusaError.Types.NOT_FOUND })
      })

      it("updates the label, unit, flags and rank, keeping its own values unique", async () => {
        const { id, definitions } = await service.createSchema(CHARGER_SPECS)
        const weight = definitions[2]

        const updated = await service.upsertDefinition({
          id: weight.id,
          label: "Peso aproximado",
          unit: "kg",
          filterable: true,
          comparable: false,
          rank: 5,
        })

        expect(updated).toEqual({
          ...weight,
          label: "Peso aproximado",
          unit: "kg",
          filterable: true,
          comparable: false,
          rank: 5,
        })
        expect((await service.getSchema(id)).definitions[2]).toEqual(updated)
        await expect(
          service.upsertDefinition({ id: weight.id, label: "Peso aproximado" }),
        ).resolves.toEqual(updated)
      })

      it("refuses a label another definition of the schema uses", async () => {
        const { definitions } = await service.createSchema(CHARGER_SPECS)

        await expect(
          service.upsertDefinition({
            id: definitions[2].id,
            label: "Conector",
          }),
        ).rejects.toMatchObject({
          type: MedusaError.Types.DUPLICATE_ERROR,
          message: 'Spec label "Conector" is defined twice',
        })
      })

      it("refuses a new key, even without values", async () => {
        const { definitions } = await service.createSchema(CHARGER_SPECS)

        await expect(
          service.upsertDefinition({ id: definitions[0].id, key: "power" }),
        ).rejects.toMatchObject({
          type: MedusaError.Types.NOT_ALLOWED,
          message: 'Spec key "maxPower" cannot change',
        })
        expect(
          (await service.getSchema(definitions[0].schema_id)).definitions[0],
        ).toEqual(definitions[0])
      })

      it("refuses moving a definition to another schema", async () => {
        const { definitions } = await service.createSchema(CHARGER_SPECS)
        const other = await service.createSchema(CHARGER_SPECS)

        await expect(
          service.upsertDefinition({
            id: definitions[0].id,
            schema_id: other.id,
          }),
        ).rejects.toMatchObject({
          type: MedusaError.Types.NOT_ALLOWED,
          message: 'Spec "maxPower" cannot move to another spec schema',
        })
      })

      it("refuses a new kind once a product has a value for the spec", async () => {
        const { id, definitions } = await service.createSchema(CHARGER_SPECS)
        await service.upsertSheet(null, id, { connector: "USB-C" })

        await expect(
          service.upsertDefinition({ id: definitions[1].id, kind: "list" }),
        ).rejects.toMatchObject({
          type: MedusaError.Types.NOT_ALLOWED,
          message:
            'Spec "connector" has values in 1 product, so its kind cannot change',
        })
        expect((await service.getSchema(id)).definitions[1].kind).toBe("text")
      })

      it("allows a new kind while no product has a value for the spec", async () => {
        const { definitions } = await service.createSchema(CHARGER_SPECS)

        const updated = await service.upsertDefinition({
          id: definitions[1].id,
          kind: "list",
        })

        expect(updated.kind).toBe("list")
      })

      it("checks the definition that results from the change", async () => {
        const { definitions } = await service.createSchema(CHARGER_SPECS)

        await expect(
          service.upsertDefinition({ id: definitions[0].id, kind: "text" }),
        ).rejects.toMatchObject({
          type: MedusaError.Types.INVALID_DATA,
          message: 'Spec "maxPower" has a unit but is not a number',
        })
      })

      it("throws NOT_FOUND for an unknown definition", async () => {
        await expect(
          service.upsertDefinition({ id: "specdef_missing", label: "Peso" }),
        ).rejects.toMatchObject({ type: MedusaError.Types.NOT_FOUND })
      })
    })

    describe("deleteDefinition", () => {
      it("removes a definition without values and frees its key", async () => {
        const { id, definitions } = await service.createSchema(CHARGER_SPECS)

        await service.deleteDefinition(definitions[2].id)

        expect(
          (await service.getSchema(id)).definitions.map((d) => d.key),
        ).toEqual(["maxPower", "connector"])
        await expect(
          service.upsertDefinition({ schema_id: id, ...CHARGER_SPECS[0] }),
        ).resolves.toMatchObject({ key: "weight" })
      })

      it("refuses deleting the last definition of a schema", async () => {
        const { id, definitions } = await service.createSchema([
          CHARGER_SPECS[0],
        ])

        await expect(
          service.deleteDefinition(definitions[0].id),
        ).rejects.toMatchObject({
          type: MedusaError.Types.NOT_ALLOWED,
          message:
            'Spec "weight" is the last one of its spec schema, which needs at least one',
        })
        expect((await service.getSchema(id)).definitions).toHaveLength(1)
      })

      it("refuses deleting a definition with values", async () => {
        const { id, definitions } = await service.createSchema(CHARGER_SPECS)
        await service.upsertSheet(null, id, { maxPower: 65 })
        await service.upsertSheet(null, id, { maxPower: 20 })

        await expect(
          service.deleteDefinition(definitions[0].id),
        ).rejects.toMatchObject({
          type: MedusaError.Types.NOT_ALLOWED,
          message:
            'Spec "maxPower" has values in 2 products; remove them first',
        })
        expect((await service.getSchema(id)).definitions).toHaveLength(3)
      })

      it("throws NOT_FOUND for an unknown definition", async () => {
        await expect(
          service.deleteDefinition("specdef_missing"),
        ).rejects.toMatchObject({ type: MedusaError.Types.NOT_FOUND })
      })
    })
  },
})
