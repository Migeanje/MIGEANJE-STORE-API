import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createProductTagsWorkflow,
} from "@medusajs/medusa/core-flows"
import { EDITORIAL_MODULE } from "../../modules/editorial"
import type EditorialModuleService from "../../modules/editorial/service"
import { SPECS_MODULE } from "../../modules/specs"
import type SpecsModuleService from "../../modules/specs/service"
import { BRANDS } from "../seed-data/brands"
import { CATEGORIES } from "../seed-data/categories"
import { PRODUCTS } from "../seed-data/products"
import { RUBRICS } from "../seed-data/rubrics"
import { productInput } from "./product-mapping"
import { graphRows } from "./query"
import { SETUP } from "./setup"

/**
 * Catalog layer of the seed (docs/seed-plan.md, steps 12–16 and 20–23).
 *
 * Every record is looked up by its natural key (handle, SKU, value, link
 * pair) first. A missing record is created; a present one is kept, so the
 * prices, stock and copy the owner changed in the admin survive a re-run.
 * The setup layer must have run: the sales channel, the shipping profile and
 * the stock location come from it.
 */
export type CatalogResult = {
  created: {
    categories: number
    collections: number
    tags: number
    products: number
    inventoryLevels: number
    specSchemas: number
    specSheets: number
    rubrics: number
    reviews: number
  }
}

type CategoryRow = {
  id: string
  handle: string
  spec_schema?: { id: string } | null
  review_rubric?: { id: string } | null
}

type ProductRow = {
  id: string
  handle: string
  product_spec_sheet?: { id: string } | null
  expert_review?: { id: string } | null
}

const idsByKey = <T extends { id: string }>(
  rows: T[],
  key: (row: T) => string | null | undefined,
) => {
  const map = new Map<string, string>()
  for (const row of rows) {
    const value = key(row)
    if (value) map.set(value, row.id)
  }
  return map
}

/** What the setup layer created and the catalog points at. */
async function setupIds(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const find = async (entity: string, filters: Record<string, unknown>) =>
    (await query.graph({ entity, fields: ["id"], filters })).data[0]?.id as
      | string
      | undefined

  const salesChannelId = await find("sales_channel", {
    name: SETUP.salesChannelName,
  })
  const shippingProfileId = await find("shipping_profile", {
    type: SETUP.shippingProfileType,
  })
  const stockLocationId = await find("stock_location", {
    name: SETUP.stockLocationName,
  })
  if (!salesChannelId || !shippingProfileId || !stockLocationId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "The catalog layer needs the setup layer first: run `seed.ts setup`.",
    )
  }
  return { salesChannelId, shippingProfileId, stockLocationId }
}

/** Step 12: categories, keyed by `handle`. */
async function ensureCategories(container: MedusaContainer, created: number[]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const find = async () =>
    (
      await query.graph({
        entity: "product_category",
        fields: ["id", "handle"],
        filters: { handle: CATEGORIES.map(({ slug }) => slug) },
      })
    ).data

  const present = idsByKey(await find(), (row) => row.handle)
  const missing = CATEGORIES.filter(({ slug }) => !present.has(slug))
  if (missing.length) {
    await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missing.map(({ slug, name }) => ({
          name,
          handle: slug,
          is_active: true,
        })),
      },
    })
    created.push(missing.length)
  }
  return idsByKey(await find(), (row) => row.handle)
}

/** Step 13: one collection per brand, keyed by `handle`. */
async function ensureCollections(
  container: MedusaContainer,
  created: number[],
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const find = async () =>
    (
      await query.graph({
        entity: "product_collection",
        fields: ["id", "handle"],
        filters: { handle: BRANDS.map(({ slug }) => slug) },
      })
    ).data

  const present = idsByKey(await find(), (row) => row.handle)
  const missing = BRANDS.filter(({ slug }) => !present.has(slug))
  if (missing.length) {
    await createCollectionsWorkflow(container).run({
      input: {
        collections: missing.map(({ slug, name }) => ({
          title: name,
          handle: slug,
        })),
      },
    })
    created.push(missing.length)
  }
  return idsByKey(await find(), (row) => row.handle)
}

/** Step 14: every distinct product tag, keyed by `value`. */
async function ensureTags(container: MedusaContainer, created: number[]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const values = [...new Set(PRODUCTS.flatMap((product) => product.tags))]
  const find = async () =>
    (
      await query.graph({
        entity: "product_tag",
        fields: ["id", "value"],
        filters: { value: values },
      })
    ).data

  const present = idsByKey(await find(), (row) => row.value)
  const missing = values.filter((value) => !present.has(value))
  if (missing.length) {
    await createProductTagsWorkflow(container).run({
      input: { product_tags: missing.map((value) => ({ value })) },
    })
    created.push(missing.length)
  }
  return idsByKey(await find(), (row) => row.value)
}

/**
 * Step 15: the products in F1 order, one workflow run each so `created_at`
 * follows the "featured" order. Keyed by `handle`; a present product (with
 * all its variants, created by the same atomic workflow) is kept.
 */
async function ensureProducts(
  container: MedusaContainer,
  context: {
    categoryIds: Map<string, string>
    collectionIds: Map<string, string>
    tagIds: Map<string, string>
    salesChannelId: string
    shippingProfileId: string
  },
  created: number[],
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: PRODUCTS.map(({ slug }) => slug) },
  })
  const present = idsByKey(data, (row) => row.handle)

  for (const product of PRODUCTS) {
    if (present.has(product.slug)) continue
    const categoryId = context.categoryIds.get(product.category)
    const collectionId = context.collectionIds.get(product.brand)
    if (!categoryId || !collectionId) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `${product.slug}: category "${product.category}" or brand "${product.brand}" was not created.`,
      )
    }
    await createProductsWorkflow(container).run({
      input: {
        products: [
          productInput(product, {
            categoryId,
            collectionId,
            tagIds: context.tagIds,
            salesChannelId: context.salesChannelId,
            shippingProfileId: context.shippingProfileId,
          }),
        ],
      },
    })
    created.push(1)
  }
}

/**
 * Step 16: one inventory level per variant at the stock location, at 0. A
 * present level is kept, so stock the owner recorded survives a re-run.
 */
async function ensureInventoryLevels(
  container: MedusaContainer,
  stockLocationId: string,
  created: number[],
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const skus = PRODUCTS.flatMap((product) =>
    product.variants.map((variant) => variant.sku),
  )
  const { data } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku", "location_levels.location_id"],
    filters: { sku: skus },
  })
  const missing = data.filter(
    (item) =>
      !item.location_levels?.some(
        (level) => level?.location_id === stockLocationId,
      ),
  )
  if (missing.length) {
    await createInventoryLevelsWorkflow(container).run({
      input: {
        inventory_levels: missing.map((item) => ({
          inventory_item_id: item.id,
          location_id: stockLocationId,
          stocked_quantity: 0,
        })),
      },
    })
    created.push(missing.length)
  }
}

/** Steps 20–23: spec schemas and sheets, rubrics and expert reviews. */
async function ensureSpecsAndEditorial(
  container: MedusaContainer,
  result: CatalogResult["created"],
) {
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const specs = container.resolve<SpecsModuleService>(SPECS_MODULE)
  const editorial = container.resolve<EditorialModuleService>(EDITORIAL_MODULE)

  const findCategories = () =>
    graphRows<CategoryRow>(
      container,
      "product_category",
      ["id", "handle", "spec_schema.id", "review_rubric.id"],
      { handle: CATEGORIES.map(({ slug }) => slug) },
    )

  // Step 20: one spec schema per category.
  for (const category of await findCategories()) {
    if (category.spec_schema?.id) continue
    const source = CATEGORIES.find(({ slug }) => slug === category.handle)
    if (!source) continue
    const schema = await specs.createSchema(
      source.specSchema.map((definition) => ({
        key: definition.key,
        label: definition.label,
        kind: definition.kind,
        rank: definition.rank,
        unit: definition.unit ?? null,
        filterable: definition.filterable,
        comparable: definition.comparable,
      })),
    )
    await link.create({
      [Modules.PRODUCT]: { product_category_id: category.id },
      [SPECS_MODULE]: { spec_schema_id: schema.id },
    })
    result.specSchemas += 1
  }

  // Step 22: one rubric per category that has criteria.
  for (const category of await findCategories()) {
    if (category.review_rubric?.id) continue
    const source = RUBRICS.find(
      ({ category: slug }) => slug === category.handle,
    )
    if (!source) continue
    const rubric = await editorial.createRubric(
      source.criteria.map((name, rank) => ({ name, rank })),
    )
    await link.create({
      [Modules.PRODUCT]: { product_category_id: category.id },
      [EDITORIAL_MODULE]: { review_rubric_id: rubric.id },
    })
    result.rubrics += 1
  }

  const categories = new Map(
    (await findCategories()).map((category) => [category.handle, category]),
  )
  const products = await graphRows<ProductRow>(
    container,
    "product",
    ["id", "handle", "product_spec_sheet.id", "expert_review.id"],
    { handle: PRODUCTS.map(({ slug }) => slug) },
  )
  const productByHandle = new Map(
    products.map((product) => [product.handle, product]),
  )

  // Steps 21 and 23, in F1 order.
  for (const source of PRODUCTS) {
    const product = productByHandle.get(source.slug)
    const category = categories.get(source.category)
    if (!product || !category) continue

    if (!product.product_spec_sheet?.id) {
      const schemaId = category.spec_schema?.id as string
      const sheet = await specs.upsertSheet(null, schemaId, source.specs)
      await link.create({
        [Modules.PRODUCT]: { product_id: product.id },
        [SPECS_MODULE]: { product_spec_sheet_id: sheet.id },
      })
      result.specSheets += 1
    }

    if (source.expertReview && !product.expert_review?.id) {
      const rubricId = category.review_rubric?.id
      if (!rubricId) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `${source.slug} has an expert review but its category "${source.category}" has no rubric.`,
        )
      }
      const [rubric] = await editorial.listRubrics([rubricId])
      const review = source.expertReview
      const scores = review.rubric.map((line) => {
        const criterion = rubric.criteria.find(
          (candidate) => candidate.name === line.criterion,
        )
        if (!criterion) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `${source.slug}: criterion "${line.criterion}" is not in the "${source.category}" rubric.`,
          )
        }
        return {
          criterion_id: criterion.id,
          score: line.score,
          note: line.note,
        }
      })
      const { id } = await editorial.upsertReview(null, rubricId, {
        verdict: review.verdict,
        for_whom: review.forWhom,
        not_for: review.notFor,
        scores,
      })
      await link.create({
        [Modules.PRODUCT]: { product_id: product.id },
        [EDITORIAL_MODULE]: { expert_review_id: id },
      })
      result.reviews += 1
    }
  }
}

export async function seedCatalog(
  container: MedusaContainer,
): Promise<CatalogResult> {
  const { salesChannelId, shippingProfileId, stockLocationId } =
    await setupIds(container)
  const sum = (counts: number[]) => counts.reduce((a, b) => a + b, 0)

  const categories: number[] = []
  const collections: number[] = []
  const tags: number[] = []
  const products: number[] = []
  const levels: number[] = []

  const categoryIds = await ensureCategories(container, categories)
  const collectionIds = await ensureCollections(container, collections)
  const tagIds = await ensureTags(container, tags)
  await ensureProducts(
    container,
    { categoryIds, collectionIds, tagIds, salesChannelId, shippingProfileId },
    products,
  )
  await ensureInventoryLevels(container, stockLocationId, levels)

  const created: CatalogResult["created"] = {
    categories: sum(categories),
    collections: sum(collections),
    tags: sum(tags),
    products: sum(products),
    inventoryLevels: sum(levels),
    specSchemas: 0,
    specSheets: 0,
    rubrics: 0,
    reviews: 0,
  }
  await ensureSpecsAndEditorial(container, created)
  return { created }
}
