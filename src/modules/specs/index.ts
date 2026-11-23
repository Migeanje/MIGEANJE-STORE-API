import { Module } from "@medusajs/framework/utils"
import SpecsModuleService from "./service"

export const SPECS_MODULE = "specs"

export default Module(SPECS_MODULE, {
  service: SpecsModuleService,
})
