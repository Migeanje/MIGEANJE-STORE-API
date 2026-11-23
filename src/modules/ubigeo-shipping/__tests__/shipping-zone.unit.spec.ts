import {
  SHIPPING_ZONE_LABELS,
  SHIPPING_ZONES,
  shippingZoneOf,
  subdivisionOf,
} from "../domain/shipping-zone"

describe("shippingZoneOf", () => {
  it("maps provincia 1501 (Lima Metropolitana) to lima_metro", () => {
    expect(shippingZoneOf({ departamento: "15", provincia: "1501" })).toBe(
      "lima_metro",
    )
  })

  it("maps departamento 07 (Callao) to callao", () => {
    expect(shippingZoneOf({ departamento: "07", provincia: "0701" })).toBe(
      "callao",
    )
  })

  it("maps the other provincias of departamento 15 to rest_of_peru", () => {
    // 1502 is Barranca, in the Lima region but outside Lima Metropolitana.
    expect(shippingZoneOf({ departamento: "15", provincia: "1502" })).toBe(
      "rest_of_peru",
    )
  })

  it("maps every other departamento to rest_of_peru", () => {
    expect(shippingZoneOf({ departamento: "04", provincia: "0401" })).toBe(
      "rest_of_peru",
    )
  })
})

describe("subdivisionOf", () => {
  it("is pe-lma for provincia 1501", () => {
    expect(
      subdivisionOf({ provincia: "1501", departamentoIso31662: "pe-lim" }),
    ).toBe("pe-lma")
  })

  it("is the departamento's ISO 3166-2 code for any other provincia", () => {
    expect(
      subdivisionOf({ provincia: "1502", departamentoIso31662: "pe-lim" }),
    ).toBe("pe-lim")
    expect(
      subdivisionOf({ provincia: "0701", departamentoIso31662: "pe-cal" }),
    ).toBe("pe-cal")
    expect(
      subdivisionOf({ provincia: "0401", departamentoIso31662: "pe-are" }),
    ).toBe("pe-are")
  })
})

describe("shipping zones", () => {
  it("are the three F1 zones with their Spanish labels", () => {
    expect(SHIPPING_ZONES).toEqual(["lima_metro", "callao", "rest_of_peru"])
    expect(SHIPPING_ZONE_LABELS).toEqual({
      lima_metro: "Lima Metropolitana",
      callao: "Callao",
      rest_of_peru: "Resto del Perú",
    })
  })
})
