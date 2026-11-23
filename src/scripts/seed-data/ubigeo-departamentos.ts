/**
 * The 25 departamentos: INEI code, official spelling (the INEI file drops the
 * accents) and the ISO 3166-2:PE subdivision code (lowercase). Lima
 * Metropolitana's own code, `pe-lma`, lives in the ubigeo-shipping module.
 */
export const DEPARTAMENTOS = [
  { code: "01", name: "Amazonas", iso: "pe-ama" },
  { code: "02", name: "Áncash", iso: "pe-anc" },
  { code: "03", name: "Apurímac", iso: "pe-apu" },
  { code: "04", name: "Arequipa", iso: "pe-are" },
  { code: "05", name: "Ayacucho", iso: "pe-aya" },
  { code: "06", name: "Cajamarca", iso: "pe-caj" },
  { code: "07", name: "Callao", iso: "pe-cal" },
  { code: "08", name: "Cusco", iso: "pe-cus" },
  { code: "09", name: "Huancavelica", iso: "pe-huv" },
  { code: "10", name: "Huánuco", iso: "pe-huc" },
  { code: "11", name: "Ica", iso: "pe-ica" },
  { code: "12", name: "Junín", iso: "pe-jun" },
  { code: "13", name: "La Libertad", iso: "pe-lal" },
  { code: "14", name: "Lambayeque", iso: "pe-lam" },
  { code: "15", name: "Lima", iso: "pe-lim" },
  { code: "16", name: "Loreto", iso: "pe-lor" },
  { code: "17", name: "Madre de Dios", iso: "pe-mdd" },
  { code: "18", name: "Moquegua", iso: "pe-moq" },
  { code: "19", name: "Pasco", iso: "pe-pas" },
  { code: "20", name: "Piura", iso: "pe-piu" },
  { code: "21", name: "Puno", iso: "pe-pun" },
  { code: "22", name: "San Martín", iso: "pe-sam" },
  { code: "23", name: "Tacna", iso: "pe-tac" },
  { code: "24", name: "Tumbes", iso: "pe-tum" },
  { code: "25", name: "Ucayali", iso: "pe-uca" },
] as const
