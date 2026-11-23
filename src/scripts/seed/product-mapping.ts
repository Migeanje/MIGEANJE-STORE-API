import type { CreateProductWorkflowInputDTO } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import type { SeedProduct, SeedVariant } from "../seed-data/types"
import { centimosToMajor } from "./money"

/** Ids of the records a product points at; the catalog layer creates them first. */
export type ProductContext = {
  collectionId: string
  categoryId: string
  /** Tag id by tag value. */
  tagIds: ReadonlyMap<string, string>
  salesChannelId: string
  shippingProfileId: string
}

/**
 * `createProductsWorkflow` rejects a product without options (verified on
 * Medusa 2.22.7: "Product options are not provided for"), so the 10 products
 * that have none get the default option the Medusa admin uses.
 */
export const DEFAULT_OPTION = {
  title: "Default option",
  value: "Default option value",
} as const

/** Option titles come from the F1 labels ("Color", "Longitud", "Chip"...). */
export const optionTitles = (product: SeedProduct): string[] =>
  product.options.map((option) => option.label)

/** Option values joined with " / "; the product title for a single variant. */
export function variantTitle(
  product: SeedProduct,
  variant: SeedVariant,
): string {
  if (product.options.length === 0) {
    return product.name
  }
  return product.options
    .map((option) => variant.options[option.key])
    .join(" / ")
}

/** Each option's values once, in the order the variants first use them. */
function optionValues(product: SeedProduct, key: string): string[] {
  const values: string[] = []
  for (const variant of product.variants) {
    const value = variant.options[key]
    if (!values.includes(value)) {
      values.push(value)
    }
  }
  return values
}

/**
 * The `createProductsWorkflow` input of one fixture product (docs/seed-plan.md,
 * "Product mapping"). Prices convert from F1 céntimos to major units; a
 * variant without a price (the Apple line, R9) gets `prices: []`.
 * `manage_inventory` is on for every variant, because Medusa's default (off)
 * would treat a variant as always in stock.
 */
export function productInput(
  product: SeedProduct,
  context: ProductContext,
): CreateProductWorkflowInputDTO {
  const tagIds = product.tags.map((tag) => {
    const id = context.tagIds.get(tag)
    if (!id) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Product tag "${tag}" of ${product.slug} was not created first.`,
      )
    }
    return id
  })

  return {
    title: product.name,
    handle: product.slug,
    description: product.summary,
    ...(product.model !== undefined && { subtitle: product.model }),
    status: "published",
    collection_id: context.collectionId,
    category_ids: [context.categoryId],
    tag_ids: tagIds,
    options:
      product.options.length === 0
        ? [{ title: DEFAULT_OPTION.title, values: [DEFAULT_OPTION.value] }]
        : product.options.map((option) => ({
            title: option.label,
            values: optionValues(product, option.key),
          })),
    variants: product.variants.map((variant) => ({
      title: variantTitle(product, variant),
      sku: variant.sku,
      options:
        product.options.length === 0
          ? { [DEFAULT_OPTION.title]: DEFAULT_OPTION.value }
          : Object.fromEntries(
              product.options.map((option) => [
                option.label,
                variant.options[option.key],
              ]),
            ),
      manage_inventory: true,
      allow_backorder: variant.availability === "backorder",
      prices:
        variant.priceCentimos === undefined
          ? []
          : [
              {
                amount: centimosToMajor(variant.priceCentimos),
                currency_code: "pen",
              },
            ],
    })),
    sales_channels: [{ id: context.salesChannelId }],
    shipping_profile_id: context.shippingProfileId,
  }
}
