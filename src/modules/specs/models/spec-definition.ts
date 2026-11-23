import { model } from "@medusajs/framework/utils"
import { SPEC_KINDS } from "../domain/spec-definition"
import SpecSchema from "./spec-schema"
import SpecValue from "./spec-value"

/** One spec a category's products can have (F1 `SpecDefinition`). */
const SpecDefinition = model
  .define("spec_definition", {
    id: model.id({ prefix: "specdef" }).primaryKey(),
    schema: model.belongsTo(() => SpecSchema, { mappedBy: "definitions" }),
    /** camelCase, e.g. "maxPower". Immutable (service rule). */
    key: model.text(),
    /** Customer label, e.g. "Potencia máxima". */
    label: model.text(),
    /** Only when `kind` is `number`, e.g. "W" or "pulgadas". */
    unit: model.text().nullable(),
    /** Decides the value column and the facet type. */
    kind: model.enum([...SPEC_KINDS]),
    /** Offered as a category page facet. */
    filterable: model.boolean().default(false),
    /** Shown as a comparator row. */
    comparable: model.boolean().default(true),
    /** F1 `order`, lower first. Renamed: `order` is an SQL keyword. */
    rank: model.number(),
    values: model.hasMany(() => SpecValue, { mappedBy: "definition" }),
  })
  .indexes([
    { on: ["schema_id", "key"], unique: true },
    { on: ["schema_id", "label"], unique: true },
    { on: ["schema_id", "rank"], unique: true },
  ])
  .checks([
    {
      name: "spec_definition_key_format",
      expression: (columns) => `${columns.key} ~ '^[a-z][a-zA-Z0-9]*$'`,
    },
    {
      name: "spec_definition_label_not_blank",
      expression: (columns) => `btrim(${columns.label}) <> ''`,
    },
    {
      name: "spec_definition_unit_only_for_numbers",
      expression: (columns) =>
        `${columns.unit} IS NULL OR ${columns.kind} = 'number'`,
    },
    {
      name: "spec_definition_rank_not_negative",
      expression: (columns) => `${columns.rank} >= 0`,
    },
  ])

export default SpecDefinition
