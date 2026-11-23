import { Module } from "@medusajs/framework/utils"
import EditorialModuleService from "./service"

export const EDITORIAL_MODULE = "editorial"

export default Module(EDITORIAL_MODULE, {
  service: EditorialModuleService,
})
