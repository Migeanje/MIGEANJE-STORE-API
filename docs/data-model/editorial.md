# editorial module

The editorial module owns the store's own opinion on products: the expert review on the product page ("Nuestra opinión") and the rubric criteria each category is scored on, which `/como-elegimos` lists. It does not own product copy (name, summary, images, tags), which stays in the Medusa product, nor the home and trust pages, whose copy F1 keeps in the storefront code. Money is not involved, so [ADR 0001](../adr/0001-money-representation.md) does not apply.

What F1 renders, and where each piece lives:

| F1 content | Source in F1 | Owner after F2 |
|---|---|---|
| Expert review (verdict, "Para quién es", "Para quién no es", rubric) | `Product.expertReview` in the catalog fixtures; 8 of 19 products have one | This module |
| Rubric criteria per category | `app/(transactional)/como-elegimos/rubric-criteria.ts`; a test checks every criterion used in a review is listed | This module (proposed) |
| Home hero, "Por qué Migeanje", "¿Qué significa «En importación»?" | Constants in the home page template (DRAFT copy) | Storefront code (proposed) |
| "Destacados" on the home page | Derived: first in-stock product per category, then the rest | Storefront rule over Medusa data; no model |
| Category tiles | Derived from categories and product counts | Medusa categories; no model |
| Trust pages (`/como-elegimos`, `/envios-y-devoluciones`, `/garantias`, `/terminos`, `/privacidad`) | Page components (DRAFT copy) | Storefront code |

F1 has no banners, buying guides or curated home sections. This module adds none. Engram #30 plans CMS guides after launch.

## Models

Medusa adds `created_at`, `updated_at` and `deleted_at` to every data model; soft delete sets `deleted_at` ([Data model properties](https://docs.medusajs.com/learn/fundamentals/data-models/properties)). The tables below leave them out. Every ID uses `model.id({ prefix })` ([id property](https://docs.medusajs.com/resources/references/data-model/property-types/id)). Unique indexes are partial, `where deleted_at` is null ([Indexes](https://docs.medusajs.com/learn/fundamentals/data-models/index)).

### `review_rubric` (ID prefix `rvrub`)

The criteria one category is scored on (proposed). One rubric per category, through a module link.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `criteria` | `hasMany(rubric_criterion)` | at least one (service rule) | |
| `reviews` | `hasMany(expert_review)` | | |

A category without a rubric cannot have reviews.

### `rubric_criterion` (ID prefix `rvcrit`)

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `rubric` | `belongsTo(review_rubric)` | required | |
| `name` | `text` | not blank; unique per rubric | Customer label, e.g. "Relación precio-calidad" |
| `rank` | `number` | ≥ 0; unique per rubric | Display order on `/como-elegimos` and in each review |

### `expert_review` (ID prefix `exrev`)

The store's opinion on one product. F1: `ExpertReview`. One review per product, through a module link.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `rubric` | `belongsTo(review_rubric)` | required | The rubric of the product's category |
| `verdict` | `text` | not blank; at most 240 characters (check) | One or two sentences |
| `for_whom` | `array` | at least one item, not blank (service rule) | "Para quién es"; order kept |
| `not_for` | `array` | at least one item, not blank (service rule) | "Para quién no es"; order kept |
| `scores` | `hasMany(rubric_score)` | at least one (service rule) | F1 `rubric` |

F1 has no draft state: a review is visible as soon as it exists. This model adds none.

### `rubric_score` (ID prefix `rvscore`)

One rubric line of a review. F1: `RubricItem`.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `review` | `belongsTo(expert_review)` | required | |
| `criterion` | `belongsTo(rubric_criterion)` | required; unique per review; from the review's rubric (service rule) | F1 `criterion` text; unique per review in F1 too |
| `score` | `number` | integer 1 to 5 (check) | Shown as LED dots |
| `note` | `text` | not blank | |

A review lists its scores in criterion `rank` order. The F1 fixtures already follow the order of `rubric-criteria.ts`.

## Module links

Links use `defineLink` ([Module links](https://docs.medusajs.com/learn/fundamentals/module-links)).

| Link | Other side | Cardinality | Options | Why |
|---|---|---|---|---|
| `product` ↔ `expert_review` | Product Module, product | one-to-one | `deleteCascade: true` on the review side | A review means nothing without its product |
| `product_category` ↔ `review_rubric` | Product Module, product category | one-to-one | none (proposed: no cascade) | Criteria are per category in F1. Deleting a category keeps its rubric for the owner to clean up |

The linkable key for product categories (`productCategory`) is not verified; F3 spike.

## Service operations

The port other code calls. Generated CRUD methods follow the service factory names ([list method](https://docs.medusajs.com/resources/service-factory-reference/methods/list)).

- `getReview(reviewId)`: verdict, for whom, not for, and scores in criterion `rank` order. Feeds the product page.
- `listRubrics(rubricIds?)`: criteria in `rank` order. Feeds `/como-elegimos` and the admin editor.
- `upsertReview(reviewId | null, rubricId, input)`: validates as F1 `expertReviewSchema` does, plus: every criterion belongs to the review's rubric.
- `upsertCriterion(...)`: keeps `name` and `rank` unique per rubric.
- `deleteCriterion(criterionId)`: refused while a score uses it (proposed). This replaces the F1 test that ties reviews to `/como-elegimos`.

Application code (a workflow, not the module) checks the rule that crosses modules: the review's rubric is the one linked to the product's category.

## Events

None emitted. None consumed: the cascade on the product link removes reviews.

## Seed and data sources

- Rubrics and criteria: `RUBRIC_CRITERIA` in the storefront's `app/(transactional)/como-elegimos/rubric-criteria.ts`. It is keyed by category name ("Cargadores"); the seed maps names to category slugs. List order becomes `rank`.
- Reviews: `expertReview` of the 8 product fixtures that have one (chargers, power banks, hubs and docks, audio, two in storage, two in wireless charging).
- Order: categories and products first (Medusa), then rubrics, then reviews, then links with `link.create` (Engram #121, seed order).
- `RUBRIC_CRITERIA` covers 6 categories. Cables, laptops and tablets have no reviews and no criteria in F1, so they get no rubric until the owner writes one.

## Open items

- F3 spike: how the product page reads the linked review: `fields` on the standard store product route, or a custom route. Not verified.
- Proposed: criteria are data, linked to categories. Alternatives: keep criterion names as text on each score and the criteria list in storefront code. Simpler, but the F1 test cannot see reviews edited in the admin, so a review could use a criterion `/como-elegimos` does not explain.
- Proposed: home and trust page copy stays in storefront code. Alternatives: a `content_block` model editable in the admin. F1 does not need it; the copy is DRAFT and changes with deploys.
- The admin needs a review editor and a criteria editor (pending since F1, Engram #107). Their routes belong to the contract map.
- The "Cómo elegimos" score scale (5 to 1 with meanings) stays as page copy.
