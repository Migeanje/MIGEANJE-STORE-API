import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createRefundReasonsWorkflow,
  updateRefundReasonsWorkflow,
} from "@medusajs/medusa/core-flows"
import { UBIGEO_SHIPPING_MODULE } from "../../modules/ubigeo-shipping"
import type UbigeoShippingModuleService from "../../modules/ubigeo-shipping/service"
import { HOLIDAYS } from "../seed-data/holidays"
import { REFUND_REASONS } from "../seed-data/refund-reasons"
import { loadUbigeoTree } from "./ubigeo"

/**
 * Reference layer of the seed (docs/seed-plan.md, steps 6, 17 and 18): the
 * ubigeo tree, the holidays and the refund reasons.
 *
 * A present record is updated to the source: the official table wins. A record
 * the source does not list is left alone (an address may point at it, and the
 * owner may add holidays of later years).
 */
export type ReferenceResult = { created: number; updated: number }

type RefundReasonRow = { id: string; code: string; label: string }

const CHUNK = 500

const chunks = <T>(items: T[], size = CHUNK): T[][] => {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

type Totals = ReferenceResult

/** Step 17: departamentos, provincias and distritos, keyed by `code`. */
async function seedUbigeo(
  service: UbigeoShippingModuleService,
  totals: Totals,
) {
  const tree = loadUbigeoTree()

  const departamentoIds = new Map<string, string>()
  const existingDepartamentos = new Map(
    (await service.listUbigeoDepartamentos({}, { take: null })).map((row) => [
      row.code,
      row,
    ]),
  )
  const newDepartamentos = tree.filter(
    (departamento) => !existingDepartamentos.has(departamento.code),
  )
  const createdDepartamentos = newDepartamentos.length
    ? await service.createUbigeoDepartamentos(
        newDepartamentos.map(({ code, name, iso_3166_2 }) => ({
          code,
          name,
          iso_3166_2,
        })),
      )
    : []
  totals.created += createdDepartamentos.length
  for (const row of createdDepartamentos) {
    departamentoIds.set(row.code, row.id)
  }
  const departamentoUpdates: {
    id: string
    name: string
    iso_3166_2: string
  }[] = []
  for (const departamento of tree) {
    const present = existingDepartamentos.get(departamento.code)
    if (!present) continue
    departamentoIds.set(departamento.code, present.id)
    if (
      present.name !== departamento.name ||
      present.iso_3166_2 !== departamento.iso_3166_2
    ) {
      departamentoUpdates.push({
        id: present.id,
        name: departamento.name,
        iso_3166_2: departamento.iso_3166_2,
      })
    }
  }
  for (const update of departamentoUpdates) {
    await service.updateUbigeoDepartamentos(update)
    totals.updated += 1
  }

  const provincias = tree.flatMap((departamento) =>
    departamento.provincias.map((provincia) => ({
      ...provincia,
      departamento_id: departamentoIds.get(departamento.code) as string,
    })),
  )
  const provinciaIds = new Map<string, string>()
  const existingProvincias = new Map(
    (await service.listUbigeoProvincias({}, { take: null })).map((row) => [
      row.code,
      row,
    ]),
  )
  const newProvincias = provincias.filter(
    (provincia) => !existingProvincias.has(provincia.code),
  )
  for (const batch of chunks(newProvincias)) {
    const created = await service.createUbigeoProvincias(
      batch.map(({ code, name, departamento_id }) => ({
        code,
        name,
        departamento_id,
      })),
    )
    totals.created += created.length
    for (const row of created) provinciaIds.set(row.code, row.id)
  }
  const provinciaUpdates: {
    id: string
    name: string
    departamento_id: string
  }[] = []
  for (const provincia of provincias) {
    const present = existingProvincias.get(provincia.code)
    if (!present) continue
    provinciaIds.set(provincia.code, present.id)
    const row = present as typeof present & { departamento_id: string }
    if (
      present.name !== provincia.name ||
      row.departamento_id !== provincia.departamento_id
    ) {
      provinciaUpdates.push({
        id: present.id,
        name: provincia.name,
        departamento_id: provincia.departamento_id,
      })
    }
  }
  for (const update of provinciaUpdates) {
    await service.updateUbigeoProvincias(update)
    totals.updated += 1
  }

  const distritos = provincias.flatMap((provincia) =>
    provincia.distritos.map((distrito) => ({
      ...distrito,
      provincia_id: provinciaIds.get(provincia.code) as string,
    })),
  )
  const existingDistritos = new Map(
    (await service.listUbigeoDistritos({}, { take: null })).map((row) => [
      row.code,
      row,
    ]),
  )
  const newDistritos = distritos.filter(
    (distrito) => !existingDistritos.has(distrito.code),
  )
  for (const batch of chunks(newDistritos)) {
    const created = await service.createUbigeoDistritos(batch)
    totals.created += created.length
  }
  const distritoUpdates: { id: string; name: string; provincia_id: string }[] =
    []
  for (const distrito of distritos) {
    const present = existingDistritos.get(distrito.code)
    if (!present) continue
    const row = present as typeof present & { provincia_id: string }
    if (
      present.name !== distrito.name ||
      row.provincia_id !== distrito.provincia_id
    ) {
      distritoUpdates.push({
        id: present.id,
        name: distrito.name,
        provincia_id: distrito.provincia_id,
      })
    }
  }
  for (const update of distritoUpdates) {
    await service.updateUbigeoDistritos(update)
    totals.updated += 1
  }
}

/** Step 18: holidays, keyed by `date`. */
async function seedHolidays(
  service: UbigeoShippingModuleService,
  totals: Totals,
) {
  const existing = new Map(
    (await service.listHolidays({}, { take: null })).map((row) => [
      row.date,
      row,
    ]),
  )
  const missing = HOLIDAYS.filter((holiday) => !existing.has(holiday.date))
  if (missing.length) {
    await service.createHolidays(missing)
    totals.created += missing.length
  }
  const renamed = HOLIDAYS.flatMap((holiday) => {
    const present = existing.get(holiday.date)
    return present && present.name !== holiday.name
      ? [{ id: present.id, name: holiday.name }]
      : []
  })
  if (renamed.length) {
    await service.updateHolidays(renamed)
    totals.updated += renamed.length
  }
}

/** Step 6: refund reasons, keyed by `code`. */
async function seedRefundReasons(container: MedusaContainer, totals: Totals) {
  const payment = container.resolve(Modules.PAYMENT)
  // The 2.22.7 types of the refund reason lack its `code` column.
  const reasons = (await payment.listRefundReasons(
    {},
    { take: null },
  )) as unknown as RefundReasonRow[]
  const existing = new Map(reasons.map((row) => [row.code, row]))
  const missing = REFUND_REASONS.filter((reason) => !existing.has(reason.code))
  if (missing.length) {
    await createRefundReasonsWorkflow(container).run({
      input: { data: missing },
    })
    totals.created += missing.length
  }
  const relabeled = REFUND_REASONS.flatMap((reason) => {
    const present = existing.get(reason.code)
    return present && present.label !== reason.label
      ? [{ id: present.id, label: reason.label }]
      : []
  })
  if (relabeled.length) {
    await updateRefundReasonsWorkflow(container).run({ input: relabeled })
    totals.updated += relabeled.length
  }
}

export async function seedReference(
  container: MedusaContainer,
): Promise<ReferenceResult> {
  const totals: Totals = { created: 0, updated: 0 }
  const service = container.resolve<UbigeoShippingModuleService>(
    UBIGEO_SHIPPING_MODULE,
  )
  await seedRefundReasons(container, totals)
  await seedUbigeo(service, totals)
  await seedHolidays(service, totals)
  return totals
}
