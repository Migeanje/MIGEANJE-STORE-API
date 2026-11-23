import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { UBIGEO_SHIPPING_MODULE } from "../../src/modules/ubigeo-shipping"
import type UbigeoShippingModuleService from "../../src/modules/ubigeo-shipping/service"
import { snapshot } from "../../src/scripts/seed/__tests__/support"
import { seedReference } from "../../src/scripts/seed/reference"
import { HOLIDAYS } from "../../src/scripts/seed-data/holidays"
import { REFUND_REASONS } from "../../src/scripts/seed-data/refund-reasons"

jest.setTimeout(300 * 1000)

const ubigeo = (container: MedusaContainer) =>
  container.resolve<UbigeoShippingModuleService>(UBIGEO_SHIPPING_MODULE)

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("seed reference layer", () => {
      it("loads the INEI tree: 25 departamentos, 196 provincias, 1,891 distritos", async () => {
        const container = getContainer()
        const result = await seedReference(container)

        const service = ubigeo(container)
        const departamentos = await service.listUbigeoDepartamentos(
          {},
          { take: null },
        )
        const provincias = await service.listUbigeoProvincias(
          {},
          { take: null },
        )
        const distritos = await service.listUbigeoDistritos({}, { take: null })
        expect(departamentos).toHaveLength(25)
        expect(provincias).toHaveLength(196)
        expect(distritos).toHaveLength(1891)
        for (const departamento of departamentos) {
          expect(departamento.iso_3166_2).toMatch(/^pe-[a-z]{3}$/)
        }
        expect(result.created).toBeGreaterThanOrEqual(25 + 196 + 1891)

        const miraflores = await service.resolveDistrito("150122")
        expect(miraflores).toEqual({
          departamento: { code: "15", name: "Lima", iso_3166_2: "pe-lim" },
          provincia: { code: "1501", name: "Lima" },
          distrito: { code: "150122", name: "Miraflores" },
        })
        expect(await service.subdivisionOf("150122")).toBe("pe-lma")
        expect(await service.subdivisionOf("040101")).toBe("pe-are")
        expect(await service.zoneOf("070101")).toBe("callao")
      })

      it("loads the holidays and the 5 refund reasons", async () => {
        const container = getContainer()
        await seedReference(container)

        const holidays = await ubigeo(container).listHolidays(
          {},
          { take: null },
        )
        expect(
          holidays.map(({ date, name }) => ({ date, name })).sort(byDate),
        ).toEqual([...HOLIDAYS].sort(byDate))
        expect(await ubigeo(container).addBusinessDays("2026-04-01", 1)).toBe(
          "2026-04-06",
        )

        const payment = container.resolve(Modules.PAYMENT)
        // Medusa adds its own default reasons at startup; the seed owns only
        // the 5 codes of ADR 0005 and leaves the others alone.
        // The 2.22.7 types of the refund reason lack its `code` column.
        const reasons = (await payment.listRefundReasons(
          { code: REFUND_REASONS.map(({ code }) => code) } as never,
          { take: null },
        )) as unknown as { code: string; label: string }[]
        expect(
          reasons
            .map(({ code, label }) => ({ code, label }))
            .sort((a, b) => a.code.localeCompare(b.code)),
        ).toEqual(
          [...REFUND_REASONS].sort((a, b) => a.code.localeCompare(b.code)),
        )
      })

      it("creates and changes nothing on a second run", async () => {
        const container = getContainer()
        await seedReference(container)
        const before = await snapshot(container)

        const second = await seedReference(container)

        expect(second).toEqual({ created: 0, updated: 0 })
        expect(await snapshot(container)).toEqual(before)
      })

      it("updates present records to the source: the official table wins", async () => {
        const container = getContainer()
        await seedReference(container)
        const service = ubigeo(container)
        const payment = container.resolve(Modules.PAYMENT)

        const [lima] = await service.listUbigeoDepartamentos({ code: "15" })
        await service.updateUbigeoDepartamentos({ id: lima.id, name: "Limaa" })
        const [miraflores] = await service.listUbigeoDistritos({
          code: "150122",
        })
        await service.updateUbigeoDistritos({
          id: miraflores.id,
          name: "Miraflorez",
        })
        const [navidad] = await service.listHolidays({ date: "2026-12-25" })
        await service.updateHolidays({ id: navidad.id, name: "Christmas" })
        const [fraud] = await payment.listRefundReasons({
          code: "fraud",
        } as never)
        await payment.updateRefundReasons([{ id: fraud.id, label: "Fraud" }])

        const result = await seedReference(container)

        expect(result).toEqual({ created: 0, updated: 4 })
        expect(
          (await service.listUbigeoDepartamentos({ code: "15" }))[0].name,
        ).toBe("Lima")
        expect(
          (await service.listUbigeoDistritos({ code: "150122" }))[0].name,
        ).toBe("Miraflores")
        expect((await service.listHolidays({ date: "2026-12-25" }))[0]).toEqual(
          expect.objectContaining({ id: navidad.id, name: "Navidad" }),
        )
        expect(
          (await payment.listRefundReasons({ code: "fraud" } as never))[0]
            .label,
        ).toBe("Fraude")
      })

      it("completes a partial seed: a missing distrito and holiday come back", async () => {
        const container = getContainer()
        await seedReference(container)
        const service = ubigeo(container)

        const [distrito] = await service.listUbigeoDistritos({ code: "150122" })
        await service.deleteUbigeoDistritos([distrito.id])
        const [holiday] = await service.listHolidays({ date: "2026-01-01" })
        await service.deleteHolidays([holiday.id])

        const result = await seedReference(container)

        expect(result).toEqual({ created: 2, updated: 0 })
        expect((await service.resolveDistrito("150122"))?.distrito.name).toBe(
          "Miraflores",
        )
        expect(await service.listHolidays({ date: "2026-01-01" })).toHaveLength(
          1,
        )
      })

      it("keeps records the source does not list", async () => {
        const container = getContainer()
        await seedReference(container)
        const service = ubigeo(container)
        await service.createHolidays({
          date: "2030-05-01",
          name: "Added by the owner",
        })

        await seedReference(container)

        expect(await service.listHolidays({ date: "2030-05-01" })).toHaveLength(
          1,
        )
      })
    })
  },
})

const byDate = (a: { date: string }, b: { date: string }) =>
  a.date.localeCompare(b.date)
