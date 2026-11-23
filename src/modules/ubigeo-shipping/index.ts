import { Module } from "@medusajs/framework/utils"
import UbigeoShippingModuleService from "./service"

/**
 * Container key of the ubigeo-shipping module. Module names must match
 * /^[a-zA-Z_][0-9a-zA-Z_]*$/ and Medusa's lint asks for snake_case, so the
 * key is `ubigeo_shipping` while the directory keeps the hyphen.
 */
export const UBIGEO_SHIPPING_MODULE = "ubigeo_shipping"

export default Module(UBIGEO_SHIPPING_MODULE, {
  service: UbigeoShippingModuleService,
})
