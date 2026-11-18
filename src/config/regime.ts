/**
 * Tax regime and the flags that depend on it (ADR 0008).
 *
 * Changing the regime is a reviewed commit, never an environment variable.
 * Under Nuevo RUS every flag except cap tracking is forced off.
 */
export type Regime = "nrus" | "b"

export type RegimeConfig = {
  regime: Regime
  facturas: boolean
  marketplaceSuppliers: boolean
  appleLinePurchasable: boolean
  igvBreakdown: boolean
  nrusCapTracking: boolean
}

export const REGIME_CONFIG: RegimeConfig = {
  regime: "nrus",
  facturas: false,
  marketplaceSuppliers: false,
  appleLinePurchasable: false,
  igvBreakdown: false,
  nrusCapTracking: true,
}

export type PeruTaxRate = {
  name: string
  code: string
  rate: number
}

/**
 * Default rate of the Peru tax region: none under Nuevo RUS, whose sales
 * carry no IGV line; 18% named "IGV" under regime B (ADR 0008, decision 2).
 */
export const peruDefaultTaxRate = (regime: Regime): PeruTaxRate | null =>
  regime === "b" ? { name: "IGV", code: "igv", rate: 18 } : null
