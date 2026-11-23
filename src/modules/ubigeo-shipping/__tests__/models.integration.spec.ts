import {
  moduleIntegrationTestRunner,
  TestDatabaseUtils,
} from "@medusajs/test-utils"
import { UBIGEO_SHIPPING_MODULE } from ".."
import type UbigeoShippingModuleService from "../service"

jest.setTimeout(60 * 1000)

// The module runner connects to its database but never creates it.
const DB_NAME = "medusa-ubigeo_shipping-integration"

beforeAll(async () => {
  await TestDatabaseUtils.dbTestUtilFactory().create(DB_NAME)
})

moduleIntegrationTestRunner<UbigeoShippingModuleService>({
  moduleName: UBIGEO_SHIPPING_MODULE,
  dbName: DB_NAME,
  resolve: "./src/modules/ubigeo-shipping",
  testSuite: ({ service }) => {
    async function createLima() {
      return service.createUbigeoDepartamentos({
        code: "15",
        name: "Lima",
        iso_3166_2: "pe-lim",
      })
    }

    async function createLimaProvincia() {
      const departamento = await createLima()
      return service.createUbigeoProvincias({
        code: "1501",
        name: "Lima",
        departamento_id: departamento.id,
      })
    }

    const deliveryEstimate = {
      zone: "lima_metro" as const,
      transit_min_days: 1,
      transit_max_days: 2,
      lead_time_min_days: null,
      lead_time_max_days: null,
      delivery_from: "2026-10-05",
      delivery_to: "2026-10-06",
    }

    describe("ubigeo_departamento", () => {
      it("stores a departamento with an ubidep_ id", async () => {
        const departamento = await createLima()
        expect(departamento).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^ubidep_/),
            code: "15",
            name: "Lima",
            iso_3166_2: "pe-lim",
          }),
        )
      })

      it("requires a two-digit code", async () => {
        for (const code of ["7", "157", "ab"]) {
          await expect(
            service.createUbigeoDepartamentos({
              code,
              name: "Lima",
              iso_3166_2: "pe-lim",
            }),
          ).rejects.toThrow(/ubigeo_departamento_code_format/)
        }
      })

      it("requires a lowercase pe-xxx ISO 3166-2 code", async () => {
        for (const iso_3166_2 of ["PE-LIM", "pe-li", "pe-lima", "cl-lim"]) {
          await expect(
            service.createUbigeoDepartamentos({
              code: "15",
              name: "Lima",
              iso_3166_2,
            }),
          ).rejects.toThrow(/ubigeo_departamento_iso_3166_2_format/)
        }
      })

      it("requires a name that is not blank", async () => {
        await expect(
          service.createUbigeoDepartamentos({
            code: "15",
            name: " \t ",
            iso_3166_2: "pe-lim",
          }),
        ).rejects.toThrow(/ubigeo_departamento_name_not_blank/)
      })

      it("keeps code and ISO 3166-2 unique among live rows", async () => {
        const lima = await createLima()
        await expect(
          service.createUbigeoDepartamentos({
            code: "15",
            name: "Otro",
            iso_3166_2: "pe-oth",
          }),
        ).rejects.toThrow(/already exists/)
        await expect(
          service.createUbigeoDepartamentos({
            code: "16",
            name: "Otro",
            iso_3166_2: "pe-lim",
          }),
        ).rejects.toThrow(/already exists/)

        await service.softDeleteUbigeoDepartamentos(lima.id)
        const again = await createLima()
        expect(again.id).not.toBe(lima.id)
      })
    })

    describe("ubigeo_provincia", () => {
      it("stores a provincia of a departamento with an ubiprov_ id", async () => {
        const provincia = await createLimaProvincia()
        expect(provincia).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^ubiprov_/),
            code: "1501",
            name: "Lima",
            departamento_id: expect.stringMatching(/^ubidep_/),
          }),
        )
        const [departamento] = await service.listUbigeoDepartamentos(
          { code: "15" },
          { relations: ["provincias"] },
        )
        expect(departamento.provincias.map(({ code }) => code)).toEqual([
          "1501",
        ])
      })

      it("requires a departamento", async () => {
        await expect(
          service.createUbigeoProvincias({ code: "1501", name: "Lima" }),
        ).rejects.toThrow(/departamento/)
      })

      it("requires a four-digit code, unique, and a name that is not blank", async () => {
        const departamento = await createLima()
        for (const code of ["15", "15011", "15a1"]) {
          await expect(
            service.createUbigeoProvincias({
              code,
              name: "Lima",
              departamento_id: departamento.id,
            }),
          ).rejects.toThrow(/ubigeo_provincia_code_format/)
        }
        await expect(
          service.createUbigeoProvincias({
            code: "1501",
            name: "",
            departamento_id: departamento.id,
          }),
        ).rejects.toThrow(/ubigeo_provincia_name_not_blank/)

        await service.createUbigeoProvincias({
          code: "1501",
          name: "Lima",
          departamento_id: departamento.id,
        })
        await expect(
          service.createUbigeoProvincias({
            code: "1501",
            name: "Otra",
            departamento_id: departamento.id,
          }),
        ).rejects.toThrow(/already exists/)
      })
    })

    describe("ubigeo_distrito", () => {
      it("stores a distrito of a provincia with an ubidist_ id", async () => {
        const provincia = await createLimaProvincia()
        const distrito = await service.createUbigeoDistritos({
          code: "150122",
          name: "Miraflores",
          provincia_id: provincia.id,
        })
        expect(distrito).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^ubidist_/),
            code: "150122",
            name: "Miraflores",
            provincia_id: provincia.id,
          }),
        )
      })

      it("requires a provincia", async () => {
        await expect(
          service.createUbigeoDistritos({ code: "150122", name: "Miraflores" }),
        ).rejects.toThrow(/provincia/)
      })

      it("requires a six-digit code, unique, and a name that is not blank", async () => {
        const provincia = await createLimaProvincia()
        for (const code of ["1501", "1501222", "15012x"]) {
          await expect(
            service.createUbigeoDistritos({
              code,
              name: "Miraflores",
              provincia_id: provincia.id,
            }),
          ).rejects.toThrow(/ubigeo_distrito_code_format/)
        }
        await expect(
          service.createUbigeoDistritos({
            code: "150122",
            name: "  ",
            provincia_id: provincia.id,
          }),
        ).rejects.toThrow(/ubigeo_distrito_name_not_blank/)

        await service.createUbigeoDistritos({
          code: "150122",
          name: "Miraflores",
          provincia_id: provincia.id,
        })
        await expect(
          service.createUbigeoDistritos({
            code: "150122",
            name: "Otro",
            provincia_id: provincia.id,
          }),
        ).rejects.toThrow(/already exists/)
      })
    })

    describe("transit_time", () => {
      it("stores a zone's transit days with a trtime_ id", async () => {
        const transit = await service.createTransitTimes({
          zone: "rest_of_peru",
          min_days: 3,
          max_days: 5,
        })
        expect(transit).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^trtime_/),
            zone: "rest_of_peru",
            min_days: 3,
            max_days: 5,
          }),
        )
        await expect(
          service.createTransitTimes({
            zone: "callao",
            min_days: 0,
            max_days: 0,
          }),
        ).resolves.toEqual(
          expect.objectContaining({ min_days: 0, max_days: 0 }),
        )
      })

      it("accepts only the three shipping zones", async () => {
        await expect(
          service.createTransitTimes({
            // @ts-expect-error: not a shipping zone
            zone: "lima",
            min_days: 1,
            max_days: 2,
          }),
        ).rejects.toThrow(/zone/)
      })

      it("requires min_days >= 0 and max_days >= min_days", async () => {
        await expect(
          service.createTransitTimes({
            zone: "callao",
            min_days: -1,
            max_days: 2,
          }),
        ).rejects.toThrow(/transit_time_min_days_non_negative/)
        await expect(
          service.createTransitTimes({
            zone: "callao",
            min_days: 3,
            max_days: 2,
          }),
        ).rejects.toThrow(/transit_time_max_days_gte_min_days/)
      })
    })

    describe("holiday", () => {
      it("stores a Lima calendar date with an hday_ id", async () => {
        const holiday = await service.createHolidays({
          date: "2026-07-28",
          name: "Fiestas Patrias",
        })
        expect(holiday).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^hday_/),
            date: "2026-07-28",
            name: "Fiestas Patrias",
          }),
        )
      })

      it("requires a YYYY-MM-DD date and a name that is not blank", async () => {
        for (const date of ["2026/07/28", "28-07-2026", "2026-7-28"]) {
          await expect(
            service.createHolidays({ date, name: "Fiestas Patrias" }),
          ).rejects.toThrow(/holiday_date_format/)
        }
        await expect(
          service.createHolidays({ date: "2026-07-28", name: " " }),
        ).rejects.toThrow(/holiday_name_not_blank/)
      })

      it("keeps the date unique among live rows", async () => {
        const holiday = await service.createHolidays({
          date: "2026-07-28",
          name: "Fiestas Patrias",
        })
        await expect(
          service.createHolidays({ date: "2026-07-28", name: "Otro" }),
        ).rejects.toThrow(/already exists/)

        await service.softDeleteHolidays(holiday.id)
        await expect(
          service.createHolidays({
            date: "2026-07-28",
            name: "Fiestas Patrias",
          }),
        ).resolves.toEqual(expect.objectContaining({ date: "2026-07-28" }))
      })
    })

    describe("delivery_estimate", () => {
      it("stores the promised dates with a dlvest_ id", async () => {
        const estimate = await service.createDeliveryEstimates(deliveryEstimate)
        expect(estimate).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^dlvest_/),
            ...deliveryEstimate,
          }),
        )
        await expect(
          service.createDeliveryEstimates({
            ...deliveryEstimate,
            lead_time_min_days: 2,
            lead_time_max_days: 4,
            delivery_from: "2026-10-07",
            delivery_to: "2026-10-12",
          }),
        ).resolves.toEqual(
          expect.objectContaining({
            lead_time_min_days: 2,
            lead_time_max_days: 4,
          }),
        )
      })

      it("accepts only the three shipping zones", async () => {
        await expect(
          service.createDeliveryEstimates({
            ...deliveryEstimate,
            // @ts-expect-error: not a shipping zone
            zone: "abroad",
          }),
        ).rejects.toThrow(/zone/)
      })

      it("requires transit_min_days >= 0 and transit_max_days >= transit_min_days", async () => {
        await expect(
          service.createDeliveryEstimates({
            ...deliveryEstimate,
            transit_min_days: -1,
          }),
        ).rejects.toThrow(/delivery_estimate_transit_min_days_non_negative/)
        await expect(
          service.createDeliveryEstimates({
            ...deliveryEstimate,
            transit_min_days: 3,
            transit_max_days: 2,
          }),
        ).rejects.toThrow(/delivery_estimate_transit_max_gte_min/)
      })

      it("requires both lead time fields or neither, with max >= min", async () => {
        await expect(
          service.createDeliveryEstimates({
            ...deliveryEstimate,
            lead_time_min_days: 2,
          }),
        ).rejects.toThrow(/delivery_estimate_lead_time_both_or_neither/)
        await expect(
          service.createDeliveryEstimates({
            ...deliveryEstimate,
            lead_time_max_days: 4,
          }),
        ).rejects.toThrow(/delivery_estimate_lead_time_both_or_neither/)
        await expect(
          service.createDeliveryEstimates({
            ...deliveryEstimate,
            lead_time_min_days: 4,
            lead_time_max_days: 2,
          }),
        ).rejects.toThrow(/delivery_estimate_lead_time_max_gte_min/)
      })

      it("requires YYYY-MM-DD dates with delivery_to on or after delivery_from", async () => {
        await expect(
          service.createDeliveryEstimates({
            ...deliveryEstimate,
            delivery_from: "05/10/2026",
          }),
        ).rejects.toThrow(/delivery_estimate_delivery_from_format/)
        await expect(
          service.createDeliveryEstimates({
            ...deliveryEstimate,
            delivery_to: "2026-10-6",
          }),
        ).rejects.toThrow(/delivery_estimate_delivery_to_format/)
        await expect(
          service.createDeliveryEstimates({
            ...deliveryEstimate,
            delivery_from: "2026-10-06",
            delivery_to: "2026-10-05",
          }),
        ).rejects.toThrow(/delivery_estimate_delivery_to_gte_from/)
        await expect(
          service.createDeliveryEstimates({
            ...deliveryEstimate,
            delivery_from: "2026-12-31",
            delivery_to: "2027-01-04",
          }),
        ).resolves.toEqual(
          expect.objectContaining({ delivery_to: "2027-01-04" }),
        )
      })
    })
  },
})
