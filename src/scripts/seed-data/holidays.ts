import type { SeedHoliday } from "./types"

/*
 * Peru's national holidays (feriados), the days delivery estimates skip.
 * Legal basis: Decreto Legislativo 713, art. 6, as amended by Ley 31788, plus
 * Ley 31822 (23 July). Dates are Lima calendar dates (YYYY-MM-DD).
 *
 * 2027 is computed under current law (Easter falls on 28 March 2027) and must
 * be re-checked: a Monday-transfer rule announced in August 2026 had no
 * published norm as of 22 August 2026.
 *
 * Public-sector "días no laborables" are not feriados and are not included.
 */
const yearly = (
  year: number,
  holyThursday: string,
  holyFriday: string,
): SeedHoliday[] => [
  { date: `${year}-01-01`, name: "Año Nuevo" },
  { date: `${year}-${holyThursday}`, name: "Jueves Santo" },
  { date: `${year}-${holyFriday}`, name: "Viernes Santo" },
  { date: `${year}-05-01`, name: "Día del Trabajo" },
  { date: `${year}-06-07`, name: "Batalla de Arica y Día de la Bandera" },
  { date: `${year}-06-29`, name: "San Pedro y San Pablo" },
  { date: `${year}-07-23`, name: "Día de la Fuerza Aérea del Perú" },
  { date: `${year}-07-28`, name: "Fiestas Patrias" },
  { date: `${year}-07-29`, name: "Fiestas Patrias" },
  { date: `${year}-08-06`, name: "Batalla de Junín" },
  { date: `${year}-08-30`, name: "Santa Rosa de Lima" },
  { date: `${year}-10-08`, name: "Combate de Angamos" },
  { date: `${year}-11-01`, name: "Día de Todos los Santos" },
  { date: `${year}-12-08`, name: "Inmaculada Concepción" },
  { date: `${year}-12-09`, name: "Batalla de Ayacucho" },
  { date: `${year}-12-25`, name: "Navidad" },
]

export const HOLIDAYS: SeedHoliday[] = [
  ...yearly(2026, "04-02", "04-03"),
  ...yearly(2027, "03-25", "03-26"),
]
