/*
 * Shipping zones (F1 `ShippingZone`). The rule stays in code: provincia 1501
 * is Lima Metropolitana, departamento 07 is Callao, everything else is the
 * rest of Peru. Medusa geo zones match the address `province`, a lowercase
 * ISO 3166-2 code, so Lima Metropolitana uses its own code, `pe-lma`.
 */

export const SHIPPING_ZONES = ["lima_metro", "callao", "rest_of_peru"] as const
export type ShippingZone = (typeof SHIPPING_ZONES)[number]

/** Customer-facing zone names. */
export const SHIPPING_ZONE_LABELS: Record<ShippingZone, string> = {
  lima_metro: "Lima Metropolitana",
  callao: "Callao",
  rest_of_peru: "Resto del Perú",
}

/** Lima Metropolitana is the provincia of Lima (departamento 15). */
export const LIMA_METRO_PROVINCIA = "1501"
/** The Callao departamento (Provincia Constitucional del Callao). */
export const CALLAO_DEPARTAMENTO = "07"
/** ISO 3166-2:PE code of Lima Metropolitana (Municipalidad Metropolitana). */
export const LIMA_METRO_SUBDIVISION = "pe-lma"

/** The zone of an address, from its departamento and provincia codes. */
export function shippingZoneOf(codes: {
  departamento: string
  provincia: string
}): ShippingZone {
  if (codes.provincia === LIMA_METRO_PROVINCIA) return "lima_metro"
  if (codes.departamento === CALLAO_DEPARTAMENTO) return "callao"
  return "rest_of_peru"
}

/**
 * The Medusa address `province` of a distrito: `pe-lma` inside Lima
 * Metropolitana, else the ISO 3166-2 code of its departamento.
 */
export function subdivisionOf(place: {
  provincia: string
  departamentoIso31662: string
}): string {
  return place.provincia === LIMA_METRO_PROVINCIA
    ? LIMA_METRO_SUBDIVISION
    : place.departamentoIso31662
}
