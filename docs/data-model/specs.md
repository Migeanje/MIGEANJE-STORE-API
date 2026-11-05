# specs module

The specs module owns the technical specifications of products: which specs each category has (label, unit, kind, display order, filter and comparator flags) and each product's values. It answers the category page facets and spec filters, the product page spec list, the product card spec tags and the comparator rows. It does not own products, categories, brands, prices or availability: those stay in Medusa. Money is not involved, so [ADR 0001](../adr/0001-money-representation.md) does not apply.

## Models

Medusa adds `created_at`, `updated_at` and `deleted_at` to every data model; soft delete sets `deleted_at` ([Data model properties](https://docs.medusajs.com/learn/fundamentals/data-models/properties)). The tables below leave them out. Every ID uses `model.id({ prefix })` ([id property](https://docs.medusajs.com/resources/references/data-model/property-types/id)). Unique indexes are partial, `where deleted_at` is null, so a soft-deleted row does not block a new one ([Indexes](https://docs.medusajs.com/learn/fundamentals/data-models/index)).

### `spec_schema` (ID prefix `specsch`)

The spec list of one category. F1: `Category.specSchema`.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `definitions` | `hasMany(spec_definition)` | at least one (service rule) | F1 requires `specSchema.min(1)` |
| `sheets` | `hasMany(product_spec_sheet)` | | |

### `spec_definition` (ID prefix `specdef`)

One spec a category's products can have. F1: `SpecDefinition`.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `schema` | `belongsTo(spec_schema)` | required | |
| `key` | `text` | camelCase (check `^[a-z][a-zA-Z0-9]*$`); unique per schema; immutable | F1 `key`, e.g. `maxPower` |
| `label` | `text` | not blank; unique per schema | Customer label, e.g. "Potencia máxima" |
| `unit` | `text` | nullable; only when `kind` is `number` (check) | Free text: "W", "mAh", "pulgadas", "dobleces" |
| `kind` | `enum` | `number`, `text`, `boolean`, `list`; immutable once values exist (proposed) | Decides the value column and the facet type |
| `filterable` | `boolean` | default `false` | Offered as a category page facet |
| `comparable` | `boolean` | default `true` | Shown as a comparator row |
| `rank` | `number` | ≥ 0; unique per schema | F1 `order`; lower first. Renamed: `order` is an SQL keyword |

F1 has no spec groups: specs are one flat list ordered by `order`. This model adds none (proposed).

### `product_spec_sheet` (ID prefix `specsheet`)

The spec values of one product. One sheet per product, through a module link.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `schema` | `belongsTo(spec_schema)` | required | The schema of the product's category when the sheet was written |
| `values` | `hasMany(spec_value)` | | A product may omit any spec (F1) |

### `spec_value` (ID prefix `specval`)

One value of one spec for one product. F1: `SpecValue` (`number | string | boolean | string[]`). Typed columns (proposed) let the module filter in SQL.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `sheet` | `belongsTo(product_spec_sheet)` | required | |
| `definition` | `belongsTo(spec_definition)` | required; unique per sheet; same schema as the sheet (service rule) | |
| `number_value` | `float` | nullable; finite | Kind `number`. Specs have decimals (1.24 kg, 13.6 pulgadas). `float` exists since v2.1.2 |
| `text_value` | `text` | nullable; not blank | Kind `text` |
| `boolean_value` | `boolean` | nullable | Kind `boolean`. The storefront shows "Sí" / "No" |
| `list_value` | `array` | nullable; at least one item, distinct, not blank (service rule) | Kind `list` (`text[]`), e.g. charging protocols |

Check: exactly one of the four value columns is not null (`num_nonnulls(...) = 1`), through `.checks()` ([Data model properties](https://docs.medusajs.com/learn/fundamentals/data-models/properties)). The service checks that the filled column matches the definition's `kind`, as F1 `specValueIssue` does.

## Module links

Links use `defineLink` ([Module links](https://docs.medusajs.com/learn/fundamentals/module-links)). Relations inside the module use `hasMany` / `belongsTo`.

| Link | Other side | Cardinality | Options | Why |
|---|---|---|---|---|
| `product_category` ↔ `spec_schema` | Product Module, product category | one-to-one | none (proposed: no cascade) | Spec schemas are per category (F1). Deleting a category keeps its schema for the owner to clean up |
| `product` ↔ `product_spec_sheet` | Product Module, product | one-to-one | `deleteCascade: true` on the sheet side | A sheet means nothing without its product |

The docs show `ProductModule.linkable.product`. The key for categories (`productCategory`) is not verified; F3 spike.

## Service operations

The port other code calls. Generated CRUD methods follow the service factory names, for example `listSpecDefinitions` ([list method](https://docs.medusajs.com/resources/service-factory-reference/methods/list)).

- `getSchema(schemaId)`: definitions in `rank` order. Feeds the category page, the comparator and the admin editor.
- `listResolvedSpecs(sheetIds)`: per sheet, the present values with their definitions, in `rank` order (F1 `resolveSpecs`). Feeds the product page, the product cards (first three tags) and the comparator.
- `computeFacets(schemaId, sheetIds)`: one facet per filterable definition, in `rank` order: `range` for numbers (min, max), `options` for text and lists (value, count), `toggle` for booleans (count of `true`). Facets no product can match are left out (F1 `computeFacets`). The caller passes the sheets of the category's published products, so counts ignore drafts.
- `matchSheets(schemaId, filters, sheetIds?)`: the sheet IDs that match every filter, mapping F1 `SpecFilter` to service filters ([Filtering](https://docs.medusajs.com/resources/service-factory-reference/tips/filtering)):

  | F1 filter | Column | Operator |
  |---|---|---|
  | `range { min?, max? }` | `number_value` | `$gte`, `$lte` |
  | `options` on `text` | `text_value` | `$in` |
  | `options` on `list` | `list_value` | `$overlap` |
  | `toggle` | `boolean_value` | `true` |

- `upsertSheet(sheetId | null, schemaId, values)`: validates every value against its definition, then replaces the sheet's values.
- `upsertDefinition(...)` and `deleteDefinition(...)`: keep `key`, `label` and `rank` unique per schema; refuse to change `kind` or `key` while values exist (proposed).

How a category listing uses it (application code, not the module): the route asks `matchSheets` for the sheet IDs, then lists products with `query.graph`, filtering by the linked sheet ID. Filtering by a linked model's property is available since v2.18.0 ([Query: filter by linked data model](https://docs.medusajs.com/learn/fundamentals/module-links/query)). This corrects Engram #121, which says Query cannot filter by linked fields.

## Events

None emitted. None consumed: the cascade on the product link removes sheets.

## Seed and data sources

- Spec schemas: `src/modules/catalog/infrastructure/fixtures/categories.ts` in the storefront, 9 categories. Each `spec(order, key, label, kind, { unit, filterable, comparable })` becomes one `spec_definition` (`order` → `rank`).
- Spec values: the `specs` record of each of the 19 product fixtures (one file per category in the same folder). Number, text, boolean and list values map to the four columns.
- Order: categories and products first (Medusa), then schemas and sheets, then links with `link.create` (Engram #121, seed order).
- Specs that change per variant (length, memory, storage) are variant options in F1, not specs. The seed keeps them as Medusa product options.

## Open items

- F3 spike: `$overlap` on an `array` column, and `$gte` / `$lte` on a `float` column. The filtering reference lists the operators without examples for these types.
- F3 spike: confirm that filtering products by the linked sheet ID runs in the database. Query falls back to in-memory filtering, which ignores pagination, in some cases (different databases, unsupported operator).
- F3 spike: the linkable key for product categories.
- F3 spike: whether the standard store product routes return linked data through `fields`, or the storefront needs custom routes. Not verified.
- Proposed: a product with a spec sheet has exactly one category (F1 `Product.category`). The admin workflow refuses a second one. Changing a product's category deletes its sheet; the owner fills it again against the new schema.
- Proposed: no spec groups (F1 has none). Alternatives: a `spec_group` model with `rank`, if the product page later groups specs.
- Proposed: typed value columns. Alternatives: one `json` value column; simpler writes, but filters would need JSON operators or in-memory filtering.
- Alternatives for linked filtering: the Index Module, if listing performance needs it.
- Later: Meilisearch (Engram #18, 6.8) indexes spec values for search; F1 search does not use specs.
