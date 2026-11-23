import { validateRubricCriteria } from "../../../modules/editorial/domain/criterion-input"
import { validateReviewInput } from "../../../modules/editorial/domain/review-input"
import {
  definitionIssues,
  duplicateDefinitionIssues,
  withDefinitionDefaults,
} from "../../../modules/specs/domain/spec-definition"
import { sheetValueIssues } from "../../../modules/specs/domain/spec-value"
import { BRANDS } from "../../seed-data/brands"
import { CATEGORIES } from "../../seed-data/categories"
import { DEMO_ACCOUNT } from "../../seed-data/demo"
import { HOLIDAYS } from "../../seed-data/holidays"
import { PRODUCTS } from "../../seed-data/products"
import { REFUND_REASONS } from "../../seed-data/refund-reasons"
import { RUBRICS } from "../../seed-data/rubrics"
import { SHIPPING_RATES } from "../../seed-data/shipping"
import { centimosToMajor } from "../money"

const variants = PRODUCTS.flatMap((product) => product.variants)

describe("catalog seed data counts", () => {
  it("has 9 categories, 4 brands, 19 products and 56 variants", () => {
    expect(CATEGORIES).toHaveLength(9)
    expect(BRANDS.map((brand) => brand.slug)).toEqual([
      "anker",
      "ugreen",
      "soundcore",
      "apple",
    ])
    expect(PRODUCTS).toHaveLength(19)
    expect(variants).toHaveLength(56)
  })

  it("has 24 in stock, 7 backorder and 25 unavailable variants", () => {
    const count = (status: string) =>
      variants.filter((variant) => variant.availability === status).length
    expect(count("in_stock")).toBe(24)
    expect(count("backorder")).toBe(7)
    expect(count("unavailable")).toBe(25)
  })

  it("has 9 spec schemas with 75 definitions, 19 spec sheets", () => {
    expect(
      CATEGORIES.reduce((total, c) => total + c.specSchema.length, 0),
    ).toBe(75)
    expect(PRODUCTS.filter((product) => product.specs)).toHaveLength(19)
  })

  it("has 6 rubrics with 30 criteria and 8 expert reviews", () => {
    expect(RUBRICS).toHaveLength(6)
    expect(RUBRICS.reduce((total, r) => total + r.criteria.length, 0)).toBe(30)
    expect(PRODUCTS.filter((product) => product.expertReview)).toHaveLength(8)
  })

  it("keeps the brand split: anker 7, ugreen 7, soundcore 2, apple 3", () => {
    const perBrand = (slug: string) =>
      PRODUCTS.filter((product) => product.brand === slug).length
    expect(perBrand("anker")).toBe(7)
    expect(perBrand("ugreen")).toBe(7)
    expect(perBrand("soundcore")).toBe(2)
    expect(perBrand("apple")).toBe(3)
  })

  it("keeps the F1 featured order", () => {
    expect(PRODUCTS[0].slug).toBe("anker-nano-charger-45w-smart-display")
    expect(PRODUCTS[15].slug).toBe("ugreen-carcasa-ssd-m2-nvme-10gbps")
    expect(PRODUCTS.slice(16).map((product) => product.slug)).toEqual([
      "macbook-air-13-m5",
      "ipad-air-11-m4",
      "airpods-pro-3",
    ])
  })
})

describe("prices", () => {
  it("has 31 priced variants, none of them Apple (R9)", () => {
    const priced = variants.filter((variant) => "priceCentimos" in variant)
    expect(priced).toHaveLength(31)

    const apple = PRODUCTS.filter((product) => product.brand === "apple")
    const appleVariants = apple.flatMap((product) => product.variants)
    expect(appleVariants).toHaveLength(25)
    for (const variant of appleVariants) {
      expect(variant).not.toHaveProperty("priceCentimos")
      expect(variant.availability).toBe("unavailable")
    }
  })

  it("holds exact céntimos that convert to major units", () => {
    const anker = variants.find((variant) => variant.sku === "ANK-A2688")
    expect(anker?.priceCentimos).toBe(18990)
    expect(centimosToMajor(anker?.priceCentimos ?? Number.NaN)).toBe(189.9)
    for (const variant of variants) {
      if (variant.priceCentimos !== undefined) {
        expect(() => centimosToMajor(variant.priceCentimos ?? 0)).not.toThrow()
      }
    }
  })

  it("has unique SKUs and slugs", () => {
    expect(new Set(variants.map((variant) => variant.sku)).size).toBe(56)
    expect(new Set(PRODUCTS.map((product) => product.slug)).size).toBe(19)
  })
})

describe("references between the data files", () => {
  const categories = new Set(CATEGORIES.map((category) => category.slug))
  const brands = new Set(BRANDS.map((brand) => brand.slug))

  it("points every product at a known category and brand", () => {
    for (const product of PRODUCTS) {
      expect(categories.has(product.category)).toBe(true)
      expect(brands.has(product.brand)).toBe(true)
    }
  })

  it("keys every rubric by a known category slug", () => {
    for (const rubric of RUBRICS) {
      expect(categories.has(rubric.category)).toBe(true)
    }
  })

  it("gives every variant a value for every product option", () => {
    for (const product of PRODUCTS) {
      for (const variant of product.variants) {
        expect(Object.keys(variant.options).sort()).toEqual(
          product.options.map((option) => option.key).sort(),
        )
      }
    }
  })

  it("scores every review criterion that its category rubric lists", () => {
    for (const product of PRODUCTS) {
      if (!product.expertReview) continue
      const rubric = RUBRICS.find((r) => r.category === product.category)
      expect(rubric).toBeDefined()
      for (const line of product.expertReview.rubric) {
        expect(rubric?.criteria).toContain(line.criterion)
      }
    }
  })
})

describe("data the modules will validate", () => {
  it("has valid spec definitions in every schema", () => {
    for (const category of CATEGORIES) {
      const fields = category.specSchema.map((definition) =>
        withDefinitionDefaults({ ...definition, unit: definition.unit }),
      )
      expect(fields.flatMap(definitionIssues)).toEqual([])
      expect(duplicateDefinitionIssues(fields)).toEqual([])
    }
  })

  it("has spec values that fit their category's schema", () => {
    for (const product of PRODUCTS) {
      const category = CATEGORIES.find((c) => c.slug === product.category)
      expect(
        sheetValueIssues(product.specs, category?.specSchema ?? []),
      ).toEqual([])
    }
  })

  it("has valid rubrics and, apart from the criterion IDs, valid reviews", () => {
    for (const rubric of RUBRICS) {
      const criteria = rubric.criteria.map((name, rank) => ({ name, rank }))
      expect(validateRubricCriteria(criteria).ok).toBe(true)
    }
    for (const product of PRODUCTS) {
      if (!product.expertReview) continue
      const review = product.expertReview
      const checked = validateReviewInput({
        verdict: review.verdict,
        for_whom: review.forWhom,
        not_for: review.notFor,
        scores: review.rubric.map((line) => ({
          criterion_id: line.criterion,
          score: line.score,
          note: line.note,
        })),
      })
      expect(checked).toMatchObject({ ok: true })
    }
  })
})

describe("shipping, holidays, refund reasons and the demo account", () => {
  it("has the three DRAFT rates and transit days", () => {
    expect(SHIPPING_RATES).toEqual([
      {
        zone: "lima_metro",
        costCentimos: 1000,
        transitDays: { min: 1, max: 2 },
      },
      { zone: "callao", costCentimos: 1200, transitDays: { min: 1, max: 2 } },
      {
        zone: "rest_of_peru",
        costCentimos: 2000,
        transitDays: { min: 3, max: 5 },
      },
    ])
  })

  it("has 16 holidays in 2026 and 16 in 2027, unique and well-formed", () => {
    expect(HOLIDAYS.filter(({ date }) => date.startsWith("2026"))).toHaveLength(
      16,
    )
    expect(HOLIDAYS.filter(({ date }) => date.startsWith("2027"))).toHaveLength(
      16,
    )
    expect(new Set(HOLIDAYS.map(({ date }) => date)).size).toBe(32)
    for (const { date, name } of HOLIDAYS) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(name.trim()).not.toBe("")
    }
  })

  it("places Holy Thursday and Good Friday around Easter", () => {
    const named = (year: string, name: string) =>
      HOLIDAYS.find(
        (holiday) => holiday.date.startsWith(year) && holiday.name === name,
      )?.date
    expect(named("2026", "Jueves Santo")).toBe("2026-04-02")
    expect(named("2026", "Viernes Santo")).toBe("2026-04-03")
    expect(named("2027", "Jueves Santo")).toBe("2027-03-25")
    expect(named("2027", "Viernes Santo")).toBe("2027-03-26")
  })

  it("has the 5 refund reasons of ADR 0005", () => {
    expect(REFUND_REASONS.map(({ code }) => code)).toEqual([
      "customer_request",
      "order_canceled",
      "return",
      "duplicate",
      "fraud",
    ])
  })

  it("keeps no password, hash or identity document in the demo account", () => {
    expect(JSON.stringify(DEMO_ACCOUNT)).not.toMatch(
      /password|hash|salt|Demo-2026|dni|document/i,
    )
    expect(DEMO_ACCOUNT.email).toBe("demo@migeanje.pe")
    expect(DEMO_ACCOUNT.addresses).toHaveLength(2)
    expect(DEMO_ACCOUNT.favorites).toEqual([
      "anker-prime-charger-100w-3-puertos",
      "soundcore-liberty-5",
    ])
  })
})
