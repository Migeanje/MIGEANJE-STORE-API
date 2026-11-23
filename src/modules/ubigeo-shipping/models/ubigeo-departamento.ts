import { model } from "@medusajs/framework/utils"
import UbigeoProvincia from "./ubigeo-provincia"

/** An INEI departamento, e.g. 15 Lima. Reference data written by the seed. */
const UbigeoDepartamento = model
  .define("ubigeo_departamento", {
    id: model.id({ prefix: "ubidep" }).primaryKey(),
    code: model.text().unique(),
    name: model.text(),
    iso_3166_2: model.text().unique(),
    provincias: model.hasMany(() => UbigeoProvincia, {
      mappedBy: "departamento",
    }),
  })
  .checks([
    {
      name: "ubigeo_departamento_code_format",
      expression: (columns) => `${columns.code} ~ '^[0-9]{2}$'`,
    },
    {
      name: "ubigeo_departamento_name_not_blank",
      expression: (columns) => `${columns.name} ~ '[^[:space:]]'`,
    },
    {
      name: "ubigeo_departamento_iso_3166_2_format",
      expression: (columns) => `${columns.iso_3166_2} ~ '^pe-[a-z]{3}$'`,
    },
  ])

export default UbigeoDepartamento
