import { readFileSync } from "node:fs"
import { join } from "node:path"
import { DEPARTAMENTOS } from "../../seed-data/ubigeo-departamentos"
import {
  buildUbigeoTree,
  loadUbigeoTree,
  parseUbigeoCsv,
  titleCasePlace,
} from "../ubigeo"

describe("titleCasePlace", () => {
  it.each([
    ["MIRAFLORES", "Miraflores"],
    ["SAN JUAN DE LURIGANCHO", "San Juan de Lurigancho"],
    ["NEPEÑA", "Nepeña"],
    ["VIZCATÁN DEL ENE", "Vizcatán del Ene"],
    ["HUAC-HUAS", "Huac-Huas"],
    ["ANCO_HUALLO", "Anco_Huallo"],
    ["QUISQUI (KICHKI)", "Quisqui (Kichki)"],
    ["LA LIBERTAD", "La Libertad"],
    ["EL TAMBO", "El Tambo"],
  ])("%s becomes %s", (source, expected) => {
    expect(titleCasePlace(source)).toBe(expected)
  })
})

describe("parseUbigeoCsv", () => {
  it("reads the INEI columns and ignores blank rows", () => {
    const rows = parseUbigeoCsv(
      [
        "IDDIST;NOMBDEP;NOMBPROV;NOMBDIST;NOM_CAPITAL (LEGAL);COD_ REG_NAT;REGION NATURAL",
        "150122;LIMA;LIMA;MIRAFLORES;MIRAFLORES;1;COSTA",
        ";;;;;;",
        "",
      ].join("\n"),
    )
    expect(rows).toEqual([
      {
        code: "150122",
        departamento: "LIMA",
        provincia: "LIMA",
        distrito: "MIRAFLORES",
      },
    ])
  })

  it("rejects a file without the expected header", () => {
    expect(() => parseUbigeoCsv("a;b\n1;2")).toThrow(/IDDIST/)
  })

  it("rejects a row whose code is not 6 digits", () => {
    expect(() =>
      parseUbigeoCsv(
        "IDDIST;NOMBDEP;NOMBPROV;NOMBDIST\n15012;LIMA;LIMA;MIRAFLORES",
      ),
    ).toThrow(/15012/)
  })
})

describe("the pinned INEI 2022 table", () => {
  const tree = loadUbigeoTree()
  const provincias = tree.flatMap((departamento) => departamento.provincias)
  const distritos = provincias.flatMap((provincia) => provincia.distritos)

  it("has 25 departamentos, 196 provincias and 1,891 distritos", () => {
    expect(tree).toHaveLength(25)
    expect(provincias).toHaveLength(196)
    expect(distritos).toHaveLength(1891)
  })

  it("gives every departamento its ISO 3166-2 code, all distinct", () => {
    const codes = tree.map((departamento) => departamento.iso_3166_2)
    expect(new Set(codes).size).toBe(25)
    for (const code of codes) expect(code).toMatch(/^pe-[a-z]{3}$/)
    expect(tree.find((d) => d.code === "15")?.iso_3166_2).toBe("pe-lim")
    expect(tree.find((d) => d.code === "07")?.iso_3166_2).toBe("pe-cal")
  })

  it("nests every code under its parent", () => {
    for (const departamento of tree) {
      for (const provincia of departamento.provincias) {
        expect(provincia.code.startsWith(departamento.code)).toBe(true)
        for (const distrito of provincia.distritos) {
          expect(distrito.code.startsWith(provincia.code)).toBe(true)
        }
      }
    }
  })

  it("keeps the places the seed and the demo account rely on", () => {
    const find = (code: string) => distritos.find((d) => d.code === code)
    expect(find("150122")?.name).toBe("Miraflores")
    expect(find("040101")?.name).toBe("Arequipa")
    expect(provincias.find((p) => p.code === "1501")?.name).toBe("Lima")
    expect(provincias.find((p) => p.code === "0701")?.name).toBe("Callao")
    expect(tree.find((d) => d.code === "02")?.name).toBe("Áncash")
  })

  it("spells every departamento as the INEI file does, minus accents and case", () => {
    const strip = (text: string) =>
      text.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase()
    const rows = parseUbigeoCsv(
      readFileSync(
        join(__dirname, "../../seed-data/ubigeo-inei-2022.csv"),
        "utf8",
      ),
    )
    for (const departamento of DEPARTAMENTOS) {
      const row = rows.find((r) => r.code.startsWith(departamento.code))
      expect(strip(departamento.name)).toBe(row?.departamento)
    }
  })

  it("rejects a departamento missing from the code table", () => {
    expect(() =>
      buildUbigeoTree([
        { code: "990101", departamento: "X", provincia: "Y", distrito: "Z" },
      ]),
    ).toThrow(/99/)
  })
})
