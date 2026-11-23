import { readFileSync } from "node:fs"
import { join } from "node:path"
import { MedusaError } from "@medusajs/framework/utils"
import { DEPARTAMENTOS } from "../seed-data/ubigeo-departamentos"

/** The pinned INEI edition (docs/seed-plan.md, "Data sources"). */
export const UBIGEO_FILE = "ubigeo-inei-2022.csv"

export type UbigeoRow = {
  code: string
  departamento: string
  provincia: string
  distrito: string
}

export type UbigeoSeedTree = {
  code: string
  name: string
  iso_3166_2: string
  provincias: {
    code: string
    name: string
    distritos: { code: string; name: string }[]
  }[]
}[]

const PARTICLES = new Set(["de", "del", "la", "las", "los", "el", "y", "e"])

/**
 * INEI writes names in capitals ("SAN JUAN DE LURIGANCHO"): title case with
 * the Spanish particles in lower case. Accents the file has are kept.
 */
export function titleCasePlace(name: string): string {
  return name
    .trim()
    .split(" ")
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("es")
      if (index > 0 && PARTICLES.has(lower)) return lower
      return lower
        .split(/([-_])/)
        .map((part) => part.replace(/\p{L}/u, (letter) => letter.toUpperCase()))
        .join("")
    })
    .join(" ")
}

/** The rows of the INEI file. Blank rows are skipped; the header is checked. */
export function parseUbigeoCsv(text: string): UbigeoRow[] {
  const [header, ...lines] = text.replace(/^﻿/, "").split(/\r?\n/)
  const columns = header.split(";")
  if (columns[0] !== "IDDIST" || columns[1] !== "NOMBDEP") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The ubigeo file must start with the INEI header (IDDIST;NOMBDEP;NOMBPROV;NOMBDIST).",
    )
  }
  return lines
    .map((line) => line.split(";"))
    .filter((cells) => cells.some((cell) => cell.trim() !== ""))
    .map(([code, departamento, provincia, distrito]) => {
      if (!/^\d{6}$/.test(code)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Ubigeo code "${code}" is not 6 digits.`,
        )
      }
      return { code, departamento, provincia, distrito }
    })
}

/**
 * The departamento / provincia / distrito tree, sorted by code. Departamentos
 * use the official spelling and ISO code of the code table; the codes of the
 * provincias and distritos come from the file.
 */
export function buildUbigeoTree(rows: UbigeoRow[]): UbigeoSeedTree {
  const tree = new Map<string, UbigeoSeedTree[number]>()
  for (const departamento of DEPARTAMENTOS) {
    tree.set(departamento.code, {
      code: departamento.code,
      name: departamento.name,
      iso_3166_2: departamento.iso,
      provincias: [],
    })
  }

  const provincias = new Map<
    string,
    UbigeoSeedTree[number]["provincias"][number]
  >()
  for (const row of [...rows].sort((a, b) => a.code.localeCompare(b.code))) {
    const departamento = tree.get(row.code.slice(0, 2))
    if (!departamento) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Ubigeo ${row.code} belongs to departamento ${row.code.slice(0, 2)}, which is not in the code table.`,
      )
    }
    const provinciaCode = row.code.slice(0, 4)
    let provincia = provincias.get(provinciaCode)
    if (!provincia) {
      provincia = {
        code: provinciaCode,
        name: titleCasePlace(row.provincia),
        distritos: [],
      }
      provincias.set(provinciaCode, provincia)
      departamento.provincias.push(provincia)
    }
    provincia.distritos.push({
      code: row.code,
      name: titleCasePlace(row.distrito),
    })
  }
  return [...tree.values()]
}

/** The pinned INEI table as a tree. */
export function loadUbigeoTree(): UbigeoSeedTree {
  const text = readFileSync(
    join(__dirname, "../seed-data", UBIGEO_FILE),
    "utf8",
  )
  return buildUbigeoTree(parseUbigeoCsv(text))
}
