/** Shapes of the typed seed data files (docs/seed-plan.md, "Data sources"). */

export type SeedSpecKind = "number" | "text" | "boolean" | "list"
export type SeedSpecValue = number | string | boolean | string[]

export type SeedSpecDefinition = {
  key: string
  label: string
  kind: SeedSpecKind
  /** The F1 `order`. */
  rank: number
  unit?: string
  filterable: boolean
  comparable: boolean
}

export type SeedCategory = {
  slug: string
  name: string
  specSchema: SeedSpecDefinition[]
}

export type SeedBrand = { slug: string; name: string }

export type SeedAvailability = "in_stock" | "backorder" | "unavailable"

export type SeedVariant = {
  sku: string
  /** Option values keyed by the F1 option `key`. */
  options: Record<string, string>
  /** F1 price in integer céntimos; absent for the Apple line (R9). */
  priceCentimos?: number
  availability: SeedAvailability
}

export type SeedExpertReview = {
  verdict: string
  forWhom: string[]
  notFor: string[]
  rubric: { criterion: string; score: number; note: string }[]
}

export type SeedProduct = {
  slug: string
  name: string
  /** Manufacturer part number; absent for two Apple products. */
  model?: string
  /** Brand slug. */
  brand: string
  /** Category slug. */
  category: string
  summary: string
  specs: Record<string, SeedSpecValue>
  options: { key: string; label: string }[]
  variants: SeedVariant[]
  tags: string[]
  expertReview?: SeedExpertReview
}

export type SeedRubric = { category: string; criteria: string[] }

export type SeedShippingZone = "lima_metro" | "callao" | "rest_of_peru"

export type SeedShippingRate = {
  zone: SeedShippingZone
  costCentimos: number
  transitDays: { min: number; max: number }
}

export type SeedDemoAddress = {
  label: string
  line: string
  reference: string
  distritoCode: string
  distritoName: string
  isDefaultShipping: boolean
}

export type SeedDemoAccount = {
  email: string
  firstName: string
  lastName: string
  phone: string
  addresses: SeedDemoAddress[]
  /** Product slugs, newest first. */
  favorites: string[]
}

export type SeedHoliday = { date: string; name: string }
export type SeedRefundReason = { code: string; label: string }
