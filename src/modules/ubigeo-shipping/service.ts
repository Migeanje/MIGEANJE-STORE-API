import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import {
  addBusinessDays,
  assertCalendarDate,
  assertDayCount,
} from "./domain/calendar"
import {
  type DeliveryEstimateInput,
  type DeliveryQuote,
  estimateDelivery,
  placementDate,
} from "./domain/delivery-estimate"
import { UbigeoShippingRuleError } from "./domain/errors"
import {
  type ShippingZone,
  shippingZoneOf,
  subdivisionOf,
} from "./domain/shipping-zone"
import DeliveryEstimate from "./models/delivery-estimate"
import Holiday from "./models/holiday"
import TransitTime from "./models/transit-time"
import UbigeoDepartamento from "./models/ubigeo-departamento"
import UbigeoDistrito from "./models/ubigeo-distrito"
import UbigeoProvincia from "./models/ubigeo-provincia"

const DISTRITO_CODE = /^\d{6}$/

export type UbigeoTree = {
  code: string
  name: string
  iso_3166_2: string
  provincias: {
    code: string
    name: string
    distritos: { code: string; name: string }[]
  }[]
}[]

export type ResolvedUbigeo = {
  departamento: { code: string; name: string; iso_3166_2: string }
  provincia: { code: string; name: string }
  distrito: { code: string; name: string }
}

const byCode = <T extends { code: string }>(a: T, b: T) =>
  a.code < b.code ? -1 : a.code > b.code ? 1 : 0

/** Turns a broken domain rule into the framework's `invalid_data` error. */
function asInvalidData<T>(run: () => T): T {
  try {
    return run()
  } catch (error) {
    if (error instanceof UbigeoShippingRuleError) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message)
    }
    throw error
  }
}

class UbigeoShippingModuleService extends MedusaService({
  UbigeoDepartamento,
  UbigeoProvincia,
  UbigeoDistrito,
  TransitTime,
  Holiday,
  DeliveryEstimate,
}) {
  /** Departamentos with their provincias and distritos, sorted by code. */
  async tree(): Promise<UbigeoTree> {
    const departamentos = await this.listUbigeoDepartamentos(
      {},
      { relations: ["provincias", "provincias.distritos"], take: null },
    )
    return [...departamentos].sort(byCode).map((departamento) => ({
      code: departamento.code,
      name: departamento.name,
      iso_3166_2: departamento.iso_3166_2,
      provincias: [...departamento.provincias]
        .sort(byCode)
        .map((provincia) => ({
          code: provincia.code,
          name: provincia.name,
          distritos: [...provincia.distritos]
            .sort(byCode)
            .map(({ code, name }) => ({ code, name })),
        })),
    }))
  }

  /** The three places when the codes exist and nest, else null. */
  async resolve(codes: {
    departamento: string
    provincia: string
    distrito: string
  }): Promise<ResolvedUbigeo | null> {
    const resolved = await this.resolveDistrito(codes.distrito)
    if (
      !resolved ||
      resolved.provincia.code !== codes.provincia ||
      resolved.departamento.code !== codes.departamento
    ) {
      return null
    }
    return resolved
  }

  /** The same from the 6-digit distrito code alone. */
  async resolveDistrito(distritoCode: string): Promise<ResolvedUbigeo | null> {
    if (!DISTRITO_CODE.test(distritoCode)) return null
    const [distrito] = await this.listUbigeoDistritos(
      { code: distritoCode },
      { relations: ["provincia", "provincia.departamento"], take: 1 },
    )
    if (!distrito?.provincia?.departamento) return null
    const { provincia } = distrito
    const { departamento } = provincia
    return {
      departamento: {
        code: departamento.code,
        name: departamento.name,
        iso_3166_2: departamento.iso_3166_2,
      },
      provincia: { code: provincia.code, name: provincia.name },
      distrito: { code: distrito.code, name: distrito.name },
    }
  }

  /** The shipping zone of a distrito, or null when the distrito is unknown. */
  async zoneOf(distritoCode: string): Promise<ShippingZone | null> {
    const place = await this.resolveDistrito(distritoCode)
    if (!place) return null
    return shippingZoneOf({
      departamento: place.departamento.code,
      provincia: place.provincia.code,
    })
  }

  /** The address `province` value of a distrito, or null when unknown. */
  async subdivisionOf(distritoCode: string): Promise<string | null> {
    const place = await this.resolveDistrito(distritoCode)
    if (!place) return null
    return subdivisionOf({
      provincia: place.provincia.code,
      departamentoIso31662: place.departamento.iso_3166_2,
    })
  }

  /** Holiday dates on or after `from`, the only ones a count from it can hit. */
  private async holidayDatesFrom(from: string): Promise<string[]> {
    const holidays = await this.listHolidays(
      { date: { $gte: from } },
      { select: ["date"], take: null },
    )
    return holidays.map(({ date }) => date)
  }

  /**
   * The Lima date `days` business days after `date` (YYYY-MM-DD), skipping
   * Saturdays, Sundays and the `holiday` table. For delivery estimates only:
   * the complaints deadline counts holidays as business days.
   */
  async addBusinessDays(date: string, days: number): Promise<string> {
    asInvalidData(() => {
      assertCalendarDate(date)
      assertDayCount(days)
    })
    const holidays = await this.holidayDatesFrom(date)
    return asInvalidData(() => addBusinessDays(date, days, holidays))
  }

  /** Delivery days (transit plus lead time) and the from / to dates. */
  async estimateDelivery(input: DeliveryEstimateInput): Promise<DeliveryQuote> {
    const start = asInvalidData(() => placementDate(input.placedAt))
    const holidays = await this.holidayDatesFrom(start)
    return asInvalidData(() => estimateDelivery(input, holidays))
  }
}

export default UbigeoShippingModuleService
