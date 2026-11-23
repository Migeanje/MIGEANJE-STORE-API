import { model } from "@medusajs/framework/utils"
import UbigeoDepartamento from "./ubigeo-departamento"
import UbigeoDistrito from "./ubigeo-distrito"

/** An INEI provincia, e.g. 1501 Lima (Lima Metropolitana). */
const UbigeoProvincia = model
  .define("ubigeo_provincia", {
    id: model.id({ prefix: "ubiprov" }).primaryKey(),
    departamento: model.belongsTo(() => UbigeoDepartamento, {
      mappedBy: "provincias",
    }),
    code: model.text().unique(),
    name: model.text(),
    distritos: model.hasMany(() => UbigeoDistrito, {
      mappedBy: "provincia",
    }),
  })
  .checks([
    {
      name: "ubigeo_provincia_code_format",
      expression: (columns) => `${columns.code} ~ '^[0-9]{4}$'`,
    },
    {
      name: "ubigeo_provincia_name_not_blank",
      expression: (columns) => `${columns.name} ~ '[^[:space:]]'`,
    },
  ])

export default UbigeoProvincia
