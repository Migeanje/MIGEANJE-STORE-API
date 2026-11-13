# customer favorites

A signed-in customer saves products as favorites ("Guardar en favoritos"). F1: `CustomerAccount.favorites`, a list of product slugs, newest first, unique, at most 100 (`MAX_FAVORITES` in the storefront's `account/domain/customer-account.ts`). [ADR 0004](../adr/0004-customer-auth.md), point 9, keeps the limit on the server, and metadata holds no business data (Engram #18). This is not a custom module: a module link between two Medusa commerce modules, with one extra column (proposed). Money is not involved, so [ADR 0001](../adr/0001-money-representation.md) does not apply.

## Models

None: link only (proposed).

### Fallback: `customer_favorite` (ID prefix `custfav`)

Only if the F3 spike on the link fails (see Open items). One small custom module, `favorites`, with one model. Medusa's wishlist guide builds favorites the same way: a custom model holding `customer_id` and `product_variant_id`, joined to Medusa with read-only links ([Wishlist plugin](https://docs.medusajs.com/resources/plugins/guides/wishlist)).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `id` | primary key | |
| `customer_id` | `text` | not blank | Medusa customer |
| `product_id` | `text` | not blank; unique with `customer_id` | Medusa product |

The implicit `created_at` orders the list. Two read-only links, `customer_favorite.customer_id` → customer and `customer_favorite.product_id` → product, let Query join them without a link table ([Read-only module link](https://docs.medusajs.com/learn/fundamentals/module-links/read-only)).

## Module links

| Link | Other side | Cardinality | Options | Why |
|---|---|---|---|---|
| `customer` ↔ `product` | Customer Module, customer; Product Module, product | many-to-many (`isList: true` on both sides) | `database.extraColumns: { favorited_at: { type: "datetime", nullable: false } }`; no `deleteCascade` | F1 favorites. The extra column keeps F1's newest-first order |

- Many-to-many: "enable `isList` on both sides of the link" ([Module links](https://docs.medusajs.com/learn/fundamentals/module-links)).
- Extra columns: `datetime` is an allowed type, and `link.create` sets them through `data` ([Add columns to a link](https://docs.medusajs.com/learn/fundamentals/module-links/custom-columns)).
- `deleteCascade` would delete customers or products with the other side, so neither side has it.
- Favorites are products, not variants: F1 stores product slugs. The slug is the Medusa product `handle` (seed plan, T9).
- The extra column is named `favorited_at`, not `created_at`. The docs do not list a link table's own columns, so a `created_at` extra column could collide with one Medusa creates. Not verified; F3 spike.
- The docs show links between custom and commerce modules ("between your custom data models and data models in the Commerce Modules"). A link defined between two commerce modules is neither shown nor ruled out. Not verified; F3 spike.
- The keys `CustomerModule.linkable.customer` and `ProductModule.linkable.product` appear in the docs (wishlist guide; module links page).

## Service operations

No module service. Three workflows in application code, behind custom routes under `/store/customers/me`, which Medusa protects for authenticated customers, custom routes included ([Protected routes](https://docs.medusajs.com/learn/fundamentals/api-routes/protected-routes)). The customer is `req.auth_context.actor_id`.

- `addFavoriteWorkflow({ customer_id, product_id })`:
  1. The product exists and is published; otherwise F1 `invalid_product` (404).
  2. Already a favorite: success, nothing changes. `link.create` on an existing link updates its extra columns ([Link](https://docs.medusajs.com/learn/fundamentals/module-links/link)), which would move it to the top; F1 `addFavorite` keeps it where it is.
  3. 100 favorites already: F1 `favorites_limit`, `NOT_ALLOWED` with code `favorites_limit`. The storefront shows "Tu lista de favoritos está llena: quita uno para guardar otro."
  4. Otherwise `createRemoteLinkStep` with `favorited_at` now.
- `removeFavoriteWorkflow({ customer_id, product_id })`: `dismissRemoteLinkStep` (same page). Not a favorite: success, as F1 `removeFavorite`.
- `listFavorites(customer_id)`: `query.graph` on the link's `entryPoint` ([Add columns to a link](https://docs.medusajs.com/learn/fundamentals/module-links/custom-columns)), filtered by `customer_id`, with `product.*`, newest `favorited_at` first. Products that are no longer published are left out (proposed).

Two adds at once with 99 favorites can reach 101 (accepted by the owner, decision D10, 2026-11-13; contract map C6). Rejected: a lock per customer, which needs a multi-instance Locking Module provider in production ([Locking Module](https://docs.medusajs.com/resources/infrastructure-modules/locking)).

### Routes (proposed; T8 fixes the names)

| Route | Purpose | F1 |
|---|---|---|
| `GET /store/customers/me/favorites` | The list, newest first | `CustomerAccount.favorites` |
| `POST /store/customers/me/favorites` | Body `{ product_id }` | `setFavorite(…, true)` |
| `DELETE /store/customers/me/favorites/:product_id` | Remove one | `setFavorite(…, false)` |

## Events

None emitted. None consumed.

## Seed and data sources

- The demo account (`account/infrastructure/fixtures/demo-account.ts` in the storefront) has two favorites: `anker-prime-charger-100w-3-puertos` and `soundcore-liberty-5`. The seed links them after products and the demo customer exist, with `link.create` (Engram #121, seed order).

## Open items

- F3 spike: define the `customer` ↔ `product` link with `isList` on both sides and the `favorited_at` extra column, then add, list in order, and dismiss. If it fails, use the fallback model.
- F3 spike: the link table's own columns. If it already has `created_at`, `favorited_at` can still stay, or be dropped.
- F3 spike: whether sorting by an extra column works on the link's `entryPoint`. If not, sort in the workflow (at most 100 rows).
- F3 spike: whether deleting a product dismisses its links, or the list must skip missing products.
- Proposed: the link. Alternative: the fallback model, which follows the official wishlist guide and gets a database unique index and `created_at` for free, at the cost of one more module.
