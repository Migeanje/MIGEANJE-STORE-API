import { model } from "@medusajs/framework/utils"
import UbigeoProvincia from "./ubigeo-provincia"

/** An INEI distrito, e.g. 150122 Miraflores. Addresses carry its code. */
const UbigeoDistrito = model
  .define("ubigeo_distrito", {
    id: model.id({ prefix: "ubidist" }).primaryKey(),
    provincia: model.belongsTo(() => UbigeoProvincia, {
      mappedBy: "distritos",
    }),
    code: model.text().unique(),
    name: model.text(),
  })
  .checks([
    {
      name: "ubigeo_distrito_code_format",
      expression: (columns) => `${columns.code} ~ '^[0-9]{6}$'`,
    },
    {
      name: "ubigeo_distrito_name_not_blank",
      expression: (columns) => `${columns.name} ~ '[^[:space:]]'`,
    },
  ])

export default UbigeoDistrito
