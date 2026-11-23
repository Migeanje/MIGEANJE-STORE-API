import {
  moduleIntegrationTestRunner,
  TestDatabaseUtils,
} from "@medusajs/test-utils"
import { UBIGEO_SHIPPING_MODULE } from ".."
import type UbigeoShippingModuleService from "../service"

jest.setTimeout(60 * 1000)

// The module runner connects to its database but never creates it. A name of
// its own keeps this suite apart from the models suite.
const DB_NAME = "medusa-ubigeo_shipping-service-integration"

beforeAll(async () => {
  await TestDatabaseUtils.dbTestUtilFactory().create(DB_NAME)
})

moduleIntegrationTestRunner<UbigeoShippingModuleService>({
  moduleName: UBIGEO_SHIPPING_MODULE,
  dbName: DB_NAME,
  resolve: "./src/modules/ubigeo-shipping",
  testSuite: ({ service }) => {
    // Lima (15) with Lima Metropolitana (1501) and Huaura (1509), Callao (07)
    // and Arequipa (04). Codes are INEI's.
    async function seedTree() {
      const lima = await service.createUbigeoDepartamentos({
        code: "15",
        name: "Lima",
        iso_3166_2: "pe-lim",
      })
      const callao = await service.createUbigeoDepartamentos({
        code: "07",
        name: "Callao",
        iso_3166_2: "pe-cal",
      })
      const arequipa = await service.createUbigeoDepartamentos({
        code: "04",
        name: "Arequipa",
        iso_3166_2: "pe-are",
      })
      const limaProvincia = await service.createUbigeoProvincias({
        code: "1501",
        name: "Lima",
        departamento_id: lima.id,
      })
      const huaura = await service.createUbigeoProvincias({
        code: "1509",
        name: "Huaura",
        departamento_id: lima.id,
      })
      const callaoProvincia = await service.createUbigeoProvincias({
        code: "0701",
        name: "Callao",
        departamento_id: callao.id,
      })
      const arequipaProvincia = await service.createUbigeoProvincias({
        code: "0401",
        name: "Arequipa",
        departamento_id: arequipa.id,
      })
      await service.createUbigeoDistritos([
        { code: "150122", name: "Miraflores", provincia_id: limaProvincia.id },
        { code: "150101", name: "Lima", provincia_id: limaProvincia.id },
        { code: "150901", name: "Huacho", provincia_id: huaura.id },
        { code: "070101", name: "Callao", provincia_id: callaoProvincia.id },
        {
          code: "040101",
          name: "Arequipa",
          provincia_id: arequipaProvincia.id,
        },
      ])
    }

    describe("tree", () => {
      it("returns departamentos, provincias and distritos sorted by code", async () => {
        await seedTree()
        const tree = await service.tree()
        expect(tree.map(({ code }) => code)).toEqual(["04", "07", "15"])
        expect(tree[2]).toEqual({
          code: "15",
          name: "Lima",
          iso_3166_2: "pe-lim",
          provincias: [
            {
              code: "1501",
              name: "Lima",
              distritos: [
                { code: "150101", name: "Lima" },
                { code: "150122", name: "Miraflores" },
              ],
            },
            {
              code: "1509",
              name: "Huaura",
              distritos: [{ code: "150901", name: "Huacho" }],
            },
          ],
        })
      })

      it("is empty before the seed", async () => {
        await expect(service.tree()).resolves.toEqual([])
      })
    })

    describe("resolve and resolveDistrito", () => {
      const miraflores = {
        departamento: { code: "15", name: "Lima", iso_3166_2: "pe-lim" },
        provincia: { code: "1501", name: "Lima" },
        distrito: { code: "150122", name: "Miraflores" },
      }

      it("resolves the three places when the codes exist and nest", async () => {
        await seedTree()
        await expect(
          service.resolve({
            departamento: "15",
            provincia: "1501",
            distrito: "150122",
          }),
        ).resolves.toEqual(miraflores)
      })

      it("returns null when a code is unknown or the codes do not nest", async () => {
        await seedTree()
        const cases = [
          { departamento: "99", provincia: "1501", distrito: "150122" },
          { departamento: "15", provincia: "1599", distrito: "150122" },
          { departamento: "15", provincia: "1501", distrito: "150199" },
          // Real codes that do not belong to each other.
          { departamento: "07", provincia: "1501", distrito: "150122" },
          { departamento: "15", provincia: "0701", distrito: "150122" },
          { departamento: "15", provincia: "1501", distrito: "150901" },
        ]
        for (const input of cases) {
          await expect(service.resolve(input)).resolves.toBeNull()
        }
      })

      it("resolves a distrito from its 6-digit code alone", async () => {
        await seedTree()
        await expect(service.resolveDistrito("150122")).resolves.toEqual(
          miraflores,
        )
      })

      it("returns null for an unknown or malformed distrito code", async () => {
        await seedTree()
        for (const code of ["150199", "1501", "abcdef", "", "1501222"]) {
          await expect(service.resolveDistrito(code)).resolves.toBeNull()
        }
      })
    })

    describe("zoneOf and subdivisionOf", () => {
      it("maps provincia 1501 to lima_metro, departamento 07 to callao, the rest to rest_of_peru", async () => {
        await seedTree()
        await expect(service.zoneOf("150122")).resolves.toBe("lima_metro")
        await expect(service.zoneOf("070101")).resolves.toBe("callao")
        await expect(service.zoneOf("040101")).resolves.toBe("rest_of_peru")
        // Lima departamento, but outside provincia 1501.
        await expect(service.zoneOf("150901")).resolves.toBe("rest_of_peru")
      })

      it("returns pe-lma inside provincia 1501, else the departamento ISO 3166-2 code", async () => {
        await seedTree()
        await expect(service.subdivisionOf("150122")).resolves.toBe("pe-lma")
        await expect(service.subdivisionOf("150901")).resolves.toBe("pe-lim")
        await expect(service.subdivisionOf("070101")).resolves.toBe("pe-cal")
        await expect(service.subdivisionOf("040101")).resolves.toBe("pe-are")
      })

      it("returns null for an unknown distrito", async () => {
        await seedTree()
        await expect(service.zoneOf("150199")).resolves.toBeNull()
        await expect(service.subdivisionOf("150199")).resolves.toBeNull()
      })
    })

    describe("addBusinessDays", () => {
      it("skips weekends and the dates of the holiday table", async () => {
        // 2026-10-08 (Thursday) is Combate de Angamos.
        await service.createHolidays({
          date: "2026-10-08",
          name: "Combate de Angamos",
        })
        // Tue 6 -> Wed 7 (1), Thu 8 is a holiday, Fri 9 (2).
        await expect(service.addBusinessDays("2026-10-06", 2)).resolves.toBe(
          "2026-10-09",
        )
        // Fri 9 + 1 skips Saturday and Sunday: Mon 12.
        await expect(service.addBusinessDays("2026-10-09", 1)).resolves.toBe(
          "2026-10-12",
        )
      })

      it("ignores soft-deleted holidays and returns the date for zero days", async () => {
        const holiday = await service.createHolidays({
          date: "2026-10-08",
          name: "Combate de Angamos",
        })
        await service.softDeleteHolidays(holiday.id)
        await expect(service.addBusinessDays("2026-10-07", 1)).resolves.toBe(
          "2026-10-08",
        )
        await expect(service.addBusinessDays("2026-10-07", 0)).resolves.toBe(
          "2026-10-07",
        )
      })

      it("skips consecutive holidays that cross a year end", async () => {
        await service.createHolidays([
          { date: "2026-12-31", name: "Closed" },
          { date: "2027-01-01", name: "Año Nuevo" },
        ])
        // Wed 30: Thu 31 and Fri 1 are holidays, then a weekend, so Mon 4.
        await expect(service.addBusinessDays("2026-12-30", 1)).resolves.toBe(
          "2027-01-04",
        )
      })

      it("rejects a malformed date or an invalid day count with invalid_data", async () => {
        await expect(
          service.addBusinessDays("2026-02-30", 1),
        ).rejects.toMatchObject({ type: "invalid_data" })
        await expect(
          service.addBusinessDays("2026-10-06", -1),
        ).rejects.toMatchObject({ type: "invalid_data" })
        await expect(
          service.addBusinessDays("2026-10-06", 1.5),
        ).rejects.toMatchObject({ type: "invalid_data" })
      })
    })

    describe("estimateDelivery", () => {
      it("counts transit plus lead time in business days from the Lima date, skipping holidays", async () => {
        await service.createHolidays({
          date: "2026-10-08",
          name: "Combate de Angamos",
        })
        // 2026-10-06T03:00Z is still Monday 5 October, 22:00, in Lima.
        const quote = await service.estimateDelivery({
          placedAt: "2026-10-06T03:00:00Z",
          transit: { min: 1, max: 2 },
          leadTimeDays: { min: 1, max: 3 },
        })
        expect(quote).toEqual({
          transitDays: { min: 1, max: 2 },
          leadTimeDays: { min: 1, max: 3 },
          deliveryDays: { min: 2, max: 5 },
          // Mon 5 + 2: Tue 6, Wed 7. + 5: 6, 7, (8 holiday), 9, 12, 13.
          from: "2026-10-07",
          to: "2026-10-13",
        })
      })

      it("works without lead time and with no holidays", async () => {
        const quote = await service.estimateDelivery({
          placedAt: new Date("2026-10-09T15:00:00Z"),
          transit: { min: 3, max: 5 },
          leadTimeDays: null,
        })
        expect(quote).toEqual({
          transitDays: { min: 3, max: 5 },
          leadTimeDays: null,
          deliveryDays: { min: 3, max: 5 },
          // Fri 9 + 3 = Wed 14; + 5 = Fri 16.
          from: "2026-10-14",
          to: "2026-10-16",
        })
      })

      it("rejects an inverted range with invalid_data", async () => {
        await expect(
          service.estimateDelivery({
            placedAt: "2026-10-09T15:00:00Z",
            transit: { min: 3, max: 2 },
            leadTimeDays: null,
          }),
        ).rejects.toMatchObject({ type: "invalid_data" })
      })
    })
  },
})
