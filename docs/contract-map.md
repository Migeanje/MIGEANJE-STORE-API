# Contract map

- Status: Proposed — pending owner review
- Date: 2026-11-05
- Related: Engram #107 (section 3), #118, #121, #481; ADRs [0001](adr/0001-money-representation.md)–[0008](adr/0008-regime-flags.md); [data model](data-model/README.md); state machines ([order](state-machines/order.md), [complaint](state-machines/complaint.md), [procurement item](state-machines/procurement-item.md))

This page maps every storefront port method to the Medusa call that replaces its mock: a standard Medusa route or a named custom route. The storefront's Medusa adapters (F4) implement it, and F3 builds the custom routes test-first against it. Ports come from the storefront code (`src/modules/*/application/ports.ts`, `catalog-repository.ts`, `account-orders.ts`, `account/ui/account-extensions.ts`, `checkout/ui/pay-action.ts`): 39 methods, all mapped below.

UI action props (`AddToCartAction`, `TrackAction`, `FileComplaintAction` and the rest) are server actions. They reach data only through the ports below, so they are not mapped on their own. Flows that have no port today are listed in [Flows without a port](#flows-without-a-port).

## Conventions

| Topic | Rule |
|---|---|
| Caller | Only the Next.js server calls Medusa: Server Components and server actions, as in F1 (no-JS). The browser never calls Medusa ([ADR 0004](adr/0004-customer-auth.md), decision 2). The Culqi Custom Checkout runs in the browser but talks only to Culqi ([ADR 0005](adr/0005-culqi-payments.md)) |
| Client | The adapters use the official JS SDK on the server (proposed). Alternative: `fetch` with the same headers. Either way, one Medusa client per request |
| Publishable key | Every `/store` call sends `x-publishable-api-key` ([missing key][pak]). The key sets the sales channel, which scopes inventory ([ADR 0007](adr/0007-availability-mapping.md)) |
| Session | Authenticated calls forward Medusa's session cookie. The storefront keeps Medusa's session id in its own httpOnly cookie (ADR 0004, decision 2). Any route under `/store/customers/me`, custom routes included, requires an authenticated customer ([Protected routes][protected]) |
| Price context | Product and cart reads pass the Peru region's `region_id`. The route needs it "if you're retrieving product variant prices with taxes" ([List products][list-products]). The region id comes from storefront configuration (proposed). Alternative: `GET /store/regions` filtered by `currency_code` `pen` at startup ([List regions][list-regions]) |
| Money | Medusa answers major units as JSON numbers with lowercase currency. The adapter converts to `Money { amountCents, currency }` by parsing the decimal, never by float math. Payable amounts are strict (a fraction of a céntimo throws); informative amounts round half-up ([ADR 0001](adr/0001-money-representation.md), decisions 3–5). `pen` becomes `PEN` |
| Ids | Medusa ids are opaque strings (`cart_…`, `order_…`, `prod_…`, `variant_…`). F1 `cartIdSchema` is a UUID and must accept them (F4) |
| Fields | `fields` selects data: `+` adds to the defaults, `-` removes, no prefix replaces ([Get order][get-order]). The storefront never requests `inventory_quantity` (ADR 0007, decision 6) |
| Errors | `NOT_ALLOWED` and `INVALID_DATA` answer HTTP 400 with an optional `code` ([Errors][errors]). The adapter maps the `code` (table below), never shows Medusa's `message`, and turns anything unknown into a generic error plus a structured log (ADR 0001, decision 4) |

### Credentials the storefront holds

The order number is never a credential ([ADR 0002](adr/0002-order-number.md), decision 5). Each guest credential lives in an httpOnly cookie on the storefront domain and never in a URL.

| Cookie | Holds after F4 | Lifetime | Opens |
|---|---|---|---|
| `mg_cart` | Medusa cart id | As F1 | The cart routes and the custom cart routes. Medusa treats the cart id as the credential |
| `mg_order` | `<number>.<order id>` (proposed; F1 holds `<number>.<accessToken>`) | 1 hour, as F1 | `GET /store/order-confirmations/:order_id` |
| `mg_complaint` | `<number>.<access_token>` | 1 hour | `GET /store/complaints/:number` ([ADR 0006](adr/0006-complaints-book.md), decision 3) |
| `mg_session` | Medusa session id | 7 days | Every `/store/customers/me` route (ADR 0004, decision 3) |
| `mg_client` | Anonymous client key | As F1 | Nothing in Medusa. Storefront throttles only |

### Error codes

| Code | Raised by | Storefront |
|---|---|---|
| `quantity_limit` | Cart `validate` hooks (ADR 0007, decision 5) | F1 quantity limit copy |
| `variant_unavailable` | Cart `validate` hooks | F1 "Agotado" copy |
| `backorder_override_not_allowed` | Add-to-cart hook | Generic error; the storefront never sends `allow_backorder` |
| `receipt_required` | Completion hook ([sunat-billing](data-model/sunat-billing.md)) | Back to the receipt step |
| `factura_not_enabled` | Receipt route, completion hook | Boleta only |
| `favorites_limit` | Favorites route ([customer favorites](data-model/customer-favorites.md)) | "Tu lista de favoritos está llena: quita uno para guardar otro." |
| `invalid_product` (404) | Favorites route | F1 copy |
| `culqi_3ds_required` | Culqi provider, only if spike S2 fails (ADR 0005, decision 7) | 3DS round trip |
| `shipping_address_invalid`, `payment_session_mismatch` | Completion hook ([ubigeo-shipping](data-model/ubigeo-shipping.md) step 5; ADR 0005 step 6). The ADRs name no code; these names are proposed | Generic checkout error |
| HTTP 401 on a session route | Medusa | Signed out: drop `mg_session`, go to sign-in |
| HTTP 404 on a guest-credential route | Custom routes | The F1 "not found" copy |
| HTTP 409, 429 | Complaints, tracking, "Avísame" | ADR 0006 copy; F1 throttle copy |

## Catalog

`CatalogRepository`. Brands are product collections and the Apple line is the `apple` collection ([data model](data-model/README.md)).

| Port.method | Medusa call | Kind | Auth | Notes |
|---|---|---|---|---|
| `listCategories()` | `GET /store/product-categories`, then `GET /store/spec-schemas?category_id=…` | standard + custom | public | `handle` → slug, `name` → name ([List categories][list-categories]). `specSchema` from the specs route. Seed order: `order=rank` (proposed; whether the store route sorts by `rank`: Not verified; F3 spike) |
| `listBrands()` | `GET /store/collections` | standard | public | `handle` → slug, `title` → name ([List collections][list-collections]) |
| `listProducts(query)` | `GET /store/product-listings`, then hydration (below) | custom + standard | public | The listing route runs the whole F1 `ProductQuery` on the server: category, brand, `filters.brands`, `filters.availability`, spec filters (specs `matchSheets`), sort and pagination. It answers ordered product ids and `total` (proposed) |
| `getProductBySlug(slug)` | `GET /store/products?handle=<slug>`, then hydration | standard | public | `null` when `count` is 0 |
| `getProductsBySlugs(slugs)` | `GET /store/products` with `handle` as an array, then hydration | standard | public | The adapter restores the requested order and skips unknown slugs (F1 contract) |
| `searchProducts(text)` | `GET /store/products?q=<text>`, then hydration | standard | public | `q` searches the product's searchable properties. F1 search is accent-insensitive; Medusa's `q`: Not verified; F3 spike. Meilisearch comes later (Engram #18, 6.8) |

Hydration: one call per piece, batched by the ids of the page.

| Piece | Call | Kind | Source |
|---|---|---|---|
| Product, variants, prices, collection, categories, images, tags, options | `GET /store/products?id=…&region_id=…` with `fields` adding `*variants.calculated_price`, `*collection`, `*categories` | standard | ADR 0007, decision 6; [List products][list-products] |
| Availability per variant | `GET /store/variant-availability?variant_id=…` | custom | ADR 0007, decision 6 |
| Specs | `GET /store/product-specs?product_id=…` | custom | [specs](data-model/specs.md) |
| Expert review | `GET /store/expert-reviews?product_id=…` | custom | [editorial](data-model/editorial.md) |

F1 product fields (proposed, as in the [seed plan](seed-plan.md)):

| F1 | Medusa |
|---|---|
| `slug`, `name`, `summary` | `handle`, `title`, `description` |
| `model` | `subtitle` (proposed in the seed plan; the MacBook and the iPad have none) |
| `brand`, `category` | `collection`, the first of `categories` |
| `images`, `tags`, `options` | `images`, `tags`, `options` |
| `variant.sku`, `variant.options` | `variants.sku`, `variants.options` |
| `variant.price` | `calculated_price.calculated_amount` ("the amount shown to the customer", [List products][list-products]) |
| `variant.compareAt` | `calculated_price.original_amount` when it is higher |
| `variant.availability` | The availability route, never `inventory_quantity` |
| `specs`, `expertReview` | The specs and editorial routes |

- Sort `featured` is F1 catalog order, and no Medusa or data model field holds it. The listing route sorts `featured` by product `created_at` ascending: the seed creates products in F1 order ([seed plan](seed-plan.md)) (proposed). A product added later in the admin goes last. Alternative: an explicit rank, which needs a model or a link.
- Facets stay in the storefront: F1 `computeFacets` over `listProducts({ categorySlug })` (proposed). Alternative: the specs module's `computeFacets` behind the listing route.
- Why a listing route: price sort, availability and spec filters cross modules, and filtering after a page breaks pagination. Alternatives: one composed route that also returns product data (fewer calls, but a second product contract and its own price context), or the standard route only with filters in the adapter (fine for 19 products, wrong counts as the catalog grows).
- If the store product routes return linked custom data through `fields` (open item in [specs](data-model/specs.md)), the specs and review calls fold into the product call.

## Cart

`CartRepository` and `ProductLookup`.

| Port.method | Medusa call | Kind | Auth | Notes |
|---|---|---|---|---|
| `CartRepository.get(id)` | `GET /store/carts/:id`, then `GET /store/variant-availability` for its variants | standard + custom | guest (cart id) | Line fields ([LineItem][line-item]): `variant_sku` → `sku`, `unit_price` → `unitPrice`, `product_title`, `variant_title`, `thumbnail`, `product_handle`, `product_collection` → product snapshot. `maxQuantity` and availability from the route. A completed cart reads as `null` (proposed) |
| `CartRepository.create()` | `POST /store/carts` with `region_id` | standard | public | ([Create cart][create-cart]). The sales channel comes from the publishable key |
| `CartRepository.save(cart)` | `POST /store/carts/:id/line-items`, `POST /store/carts/:id/line-items/:line_id`, `DELETE /store/carts/:id/line-items/:line_id` | standard | guest (cart id) | Medusa has no replace-cart route. The adapter diffs the saved cart against Medusa's: new SKU → add (`variant_id`, `quantity`), new quantity → update, missing SKU → remove ([Add][add-line], [Update][update-line], [Remove][remove-line]). It never sends `metadata`, so Medusa keeps one line per variant (ADR 0007). Clearing the cart removes every line (proposed) |
| `ProductLookup.findOffer(sku)` | `GET /store/products` filtered by `variants.sku`, then `GET /store/variant-availability` | standard + custom | public | The filter exists only nested as `variants.sku` ([List products][list-products]). The offer gains the variant id the cart routes need (F4). Query-string form of the nested filter: Not verified; F3 spike |

- Limits are enforced by the `validate` hooks of add, update and complete (ADR 0007, decision 5). The storefront keeps the F1 clamp before it sends.
- Proposed for F4: split `save` into `addLine`, `setQuantity`, `removeLine` and `clear`, so the adapter needs no diff. Alternative: keep `save` and diff as above.
- Not used: setting the cart's customer after sign-in ([Update cart][update-cart-guide], v2.0.5+). Account orders are found by verified email, so they do not need `customer_id` (proposed). Alternative: call it after sign-in so orders carry the customer.

## Checkout

`CheckoutDraftRepository`, `UbigeoDirectory`, and the function ports `PayAction` and `PendingPaymentLookup`.

| Port.method | Medusa call | Kind | Auth | Notes |
|---|---|---|---|---|
| `CheckoutDraftRepository.get(cartId)` | `GET /store/carts/:id`, then `GET /store/carts/:id/receipt` | standard + custom | guest (cart id) | `contact.customer`: names and phone from `shipping_address`, `email` from the cart, document from the receipt request. `contact.address`: `address_1` → line, `address_2` → reference, `postal_code` → distrito ubigeo, resolved with the tree ([ubigeo-shipping](data-model/ubigeo-shipping.md)). `receipt` from the receipt request; no receipt choice yet while its `type` is null. The contact step stores the document there (C1, decided) |
| `CheckoutDraftRepository.save(draft)`, contact | `POST /store/carts/:id` (`email`, `shipping_address`, `billing_address`), `GET /store/shipping-options?cart_id=…`, `POST /store/carts/:id/shipping-methods` (`option_id`) | standard | guest (cart id) | Address per ubigeo-shipping: `country_code` `pe`, `province` from `subdivisionOf`, `city` the distrito name, `postal_code` the ubigeo ([Update cart][update-cart], [Cart options][cart-options], [Add shipping method][add-shipping]). The province leaves one option, so the adapter adds it: F1 has no shipping choice (proposed). `billing_address` copies the shipping address (proposed). Then `POST /store/carts/:id/receipt` with the DNI or CE and the name only, `type` null, so the document survives a reload (C1, decided) |
| `CheckoutDraftRepository.save(draft)`, receipt | `POST /store/carts/:id/receipt` | custom | guest (cart id) | Boleta, or factura when the flag is on. Posting again updates in place (sunat-billing) |
| `CheckoutDraftRepository.delete(cartId)` | None | none | — | A completed cart keeps its data in Medusa. The storefront drops `mg_cart` after completion (proposed) |
| `UbigeoDirectory.tree()` | `GET /store/ubigeo` | custom | public | The whole tree, cacheable. Same route for complaints and the address book |
| `PayAction` | `POST /store/payment-collections` (`cart_id`), `POST /store/payment-collections/:id/payment-sessions` (`provider_id: "pp_culqi_culqi"`), `POST /store/payment-collections/:id/payment-sessions/:session_id` (`client_data`), `POST /store/carts/:id/complete` | standard | guest (cart id) | ADR 0005, decision 4. The session is initialized when the payment step opens ([Create payment collection][create-collection], [Initialize session][init-session]). After the fingerprint check: update ([Update session][update-session], v2.22.1+), then complete ([Complete cart][complete-cart]). `type: "order"`: set `mg_order`, drop `mg_cart`, redirect to the confirmation. `type: "cart"`: read `payment_collection.payment_sessions` for `decline_reason` or 3DS (ADR 0005, decisions 7 and 14) |
| `PendingPaymentLookup(cartId)` | `GET /store/carts/:id/payment-reconciliation`, plus the session's `charge_status` from `GET /store/carts/:id` | custom + standard | guest (cart id) | Pending while an open record exists or `charge_status` is `unknown` (ADR 0005, decision 15; [culqi](data-model/culqi.md)). F1 `PendingPayment.reference` is dropped in F4: the pending notice shows no reference (C3, decided) |

- The order number for the redirect is formatted from `display_id` and `created_at` of the completed order (ADR 0002, decision 3).
- Shipping rates and the delivery estimate have no F1 port: see [Flows without a port](#flows-without-a-port).

## Orders

`OrderRepository`, `PaymentGateway` and `ReconciliationLog`. The three order routes answer one **order view**: F1 `Order` without `accessToken` and `payment.chargeId` (proposed), with the status and timeline of [ADR 0003](adr/0003-order-status-projection.md), the refunds list, the delivery estimate ([ubigeo-shipping](data-model/ubigeo-shipping.md)) and the comprobante type, series and number once issued ([sunat-billing](data-model/sunat-billing.md)). Draft orders never appear (ADR 0003, decision 8).

| Port.method | Medusa call | Kind | Auth | Notes |
|---|---|---|---|---|
| `OrderRepository.reserveNumber(placedAt)` | None | none | — | The number derives from the order that completion returns (ADR 0002) |
| `OrderRepository.save(order)` | None: `POST /store/carts/:id/complete` creates the order | none | — | Medusa creates the order before it charges (ADR 0005) |
| `OrderRepository.findByNumber(number)`, through `findOrder` with the email | `POST /store/order-tracking` with `{ number, email }` | custom | public, throttled | ADR 0002, decisions 4–5: parse the number, find by `display_id`, check the Lima year and the email. Any mismatch answers 404. POST keeps the email out of URLs and logs (proposed) |
| `OrderRepository.findByNumber(number)`, through `findOrderWithAccessToken` | `GET /store/order-confirmations/:order_id` | custom | guest (order id from `mg_order`) | Answers only during the first hour after `created_at`, like F1's cookie; afterwards 404, and the page asks for the email (proposed) |
| `OrderRepository.findByEmail(email)` | `GET /store/customers/me/orders` | custom | session | ADR 0004, decision 6: orders whose `email` is the customer's verified email, plus orders with its `customer_id`. Summaries, newest first. The email comes from the session, never from the caller |
| `PaymentGateway.charge(request)` | Covered by `PayAction` | none | — | Card data never reaches our servers (R1). `PaymentCard` stays in the mock |
| `ReconciliationLog.record(entry)` | None | none | — | The job `culqi-reconcile-charges` writes `culqi_reconciliation` (ADR 0005, decision 15) |
| `ReconciliationLog.findByCart(cartId)` | `GET /store/carts/:id/payment-reconciliation` | custom | guest (cart id) | Same route as `PendingPaymentLookup`. Answers whether an open record exists, with no personal data |

- The port shape changes in F4: `findByNumber` becomes `track(number, email)` and `findForConfirmation(orderId)`; `findByEmail` takes no argument.
- Account order detail keeps the F1 path: the confirmation page, opened with the cookie or the email (proposed). Alternative: `GET /store/customers/me/orders/:number` for a signed-in owner.
- Securing `GET /store/orders/:id`: it "doesn't require customer authentication, so that guest customers can view their order confirmation page" ([Get order][get-order]), and "The order's ID acts as the credential" ([Restrict order retrieval][secure-order]). The storefront never calls it. A middleware applies the guide: `authenticate("customer", ["session", "bearer"])` plus an owner check, without `allowUnauthenticated` (proposed). Alternative: `allowUnauthenticated` plus an email check for guests.
- `GET /store/orders` lists only the signed-in customer's own orders ([List orders][list-orders]), so it misses guest orders. That is why the account route is custom.

## Complaints

`ComplaintRepository` and `ComplaintNotifier` ([ADR 0006](adr/0006-complaints-book.md), [complaints](data-model/complaints.md)).

| Port.method | Medusa call | Kind | Auth | Notes |
|---|---|---|---|---|
| `ComplaintRepository.file(complaint)` | `POST /store/complaints` | custom | public, throttled | Body carries `submission_id` from a hidden field (F4). 201 new; 200 same submission; 409 same id, other body; 400 `invalid_data`; 429. Answers `number`, `filed_at`, `response_due_date`, `access_token`, `copy` (`sent` or `pending`) |
| `ComplaintRepository.markCopySent(number, sentAt)` | None | none | — | The backend sends the copy and sets `copy_sent_at` (ADR 0006, decision 4) |
| `ComplaintRepository.findByNumber(number)` | `GET /store/complaints/:number` with `x-complaint-access-token` | custom | guest (token from `mg_complaint`) | First hour after `filed_at` only. Wrong number, wrong token or expired: 404. The port gains the token argument (F4) |
| `ComplaintNotifier.sendCopy(sheet)` | None | none | — | `sendComplaintCopyWorkflow` and the job `retry-complaint-copies` |

The complaints form reuses `UbigeoDirectory.tree()` (`GET /store/ubigeo`).

## Account

`CustomerAccountRepository`, `PasswordHasher`, `SessionStore`, and the function ports `OrdersByEmail`, `AccountOrdersLookup` and `FavoriteProductsLookup` ([ADR 0004](adr/0004-customer-auth.md), [customer favorites](data-model/customer-favorites.md)).

| Port.method | Medusa call | Kind | Auth | Notes |
|---|---|---|---|---|
| `CustomerAccountRepository.create(account, password)` | `POST /auth/customer/emailpass/register`, then `POST /store/customers` with the names; after verification, at the first login: `POST /auth/customer/emailpass`, `POST /auth/session` | standard | registration token, then the login JWT | ADR 0004, decision 5 ([Register][register-guide], [Register customer][register-customer], [Verify account][verify-guide]). "Identity with email already exists" maps to `email_taken`. The customer and its names are created at registration (C2, decided; F3 spike) |
| `CustomerAccountRepository.findById(id)` | `GET /store/customers/me`, plus `GET /store/customers/me/favorites` | standard + custom | session | The id is the session's customer ([Get customer][get-customer]). A Medusa session implies a verified email (ADR 0004), so the account reads as verified. Since C2 creates the customer at registration, its `created_at` is not the verification time: `emailVerifiedAt` comes from Medusa's verification record if it exposes one (F3 spike), otherwise from the first sign-in. `document` reads as `null` and F4 drops it (C4, decided) |
| `CustomerAccountRepository.findCredentials(email)` | None | none | — | Medusa checks the password at `POST /auth/customer/emailpass` |
| `CustomerAccountRepository.save(account)` | `POST /store/customers/me` (`first_name`, `last_name`, `phone`); `POST /store/customers/me/addresses`; `POST`, `DELETE /store/customers/me/addresses/:address_id`; `POST /store/customers/me/favorites`; `DELETE /store/customers/me/favorites/:product_id` | standard + custom | session | Medusa saves per resource, so the adapter diffs; F4 may split the port as for the cart (proposed). The update route takes no `email`, matching F1's rule that the email never changes ([Update customer][update-customer]). Address: `address_name` → label, `address_1` → line, `address_2` → reference, `postal_code` → ubigeo, `is_default_shipping` → default ([Create address][create-address], [Update address][update-address], [Remove address][remove-address]). Favorites take the product id; the adapter resolves F1 slugs (handles). `document` is never written |
| `PasswordHasher.hash(password)`, `PasswordHasher.verify(password, hash)` | None | none | — | Medusa hashes with scrypt (ADR 0004, decision 1) |
| `SessionStore.create(customerId, now)` | `POST /auth/customer/emailpass`, then `POST /auth/session` with the JWT | standard | — | The JWT is used once and never stored ([Login][login-guide]) |
| `SessionStore.find(token, now)` | `GET /store/customers/me` with the forwarded session cookie | standard | session | 401 means signed out |
| `SessionStore.revoke(token)` | `DELETE /auth/session` | standard | session | Destroys the session in Medusa (ADR 0004, decision 2) |
| `OrdersByEmail(email)`, `AccountOrdersLookup(email)` | `GET /store/customers/me/orders` | custom | session | Same route as `OrderRepository.findByEmail`. The argument is ignored. The F1 `email_unverified` state disappears (ADR 0004) |
| `FavoriteProductsLookup(slugs)` | Catalog `getProductsBySlugs`: `GET /store/products` by `handle`, then hydration | standard | public | The slugs come from the favorites list, newest first |

Login and registration failures keep the F1 throttle in the storefront (10 per 15 minutes per client key). The backend adds its own (ADR 0004, decision 8).

## Ports with no Medusa counterpart

They keep their mock adapters. Their Medusa adapters do not exist; F4 removes their calls from the Medusa path.

| Port.method | Replaced by | Source |
|---|---|---|
| `OrderRepository.reserveNumber` | Formatting of `display_id` and the Lima year of `created_at` | [ADR 0002](adr/0002-order-number.md) |
| `OrderRepository.save` | `completeCartWorkflow`, through `POST /store/carts/:id/complete` | [ADR 0005](adr/0005-culqi-payments.md), decision 4 |
| `PaymentGateway.charge` with `PaymentCard` | A Culqi token in a `pp_culqi_culqi` session, charged by the provider | ADR 0005, decisions 1 and 15 |
| `ReconciliationLog.record` | The job `culqi-reconcile-charges` and `culqi_reconciliation` | ADR 0005, decision 15 |
| `ComplaintRepository.markCopySent`, `ComplaintNotifier.sendCopy` | `sendComplaintCopyWorkflow` and `retry-complaint-copies` | [ADR 0006](adr/0006-complaints-book.md), decision 4 |
| `CustomerAccountRepository.findCredentials` | Medusa login | [ADR 0004](adr/0004-customer-auth.md), decision 1 |
| `PasswordHasher.hash`, `PasswordHasher.verify` | Medusa `emailpass` with scrypt | ADR 0004, decision 1 |
| `SessionStore.create`, `find`, `revoke` | Medusa cookie session in Redis | ADR 0004, decisions 2–4 |
| `CheckoutDraftRepository.delete` | Nothing: completed carts stay in Medusa; the storefront drops `mg_cart` | This map (proposed) |
| `AttemptLimiter` (shared library, not a data port) | Stays in the storefront for every data source, as F1. Backend limits are added on top | ADR 0002, decision 5; ADR 0004, decision 8 |

## Flows without a port

| Flow | F1 today | Medusa call | Source |
|---|---|---|---|
| "Olvidé mi contraseña" | Mock: sends nothing | `POST /auth/customer/emailpass/reset-password` with `identifier`. It "returns a successful response always, even if the customer's email doesn't exist" ([Reset token][reset-token], [Reset guide][reset-guide]) | ADR 0004, decision 7 |
| Set a new password | No page | `POST /auth/customer/emailpass/update` with `email`, `password` and `Authorization: Bearer <token>` ([Reset password][reset-password]) | ADR 0004, decision 7 |
| Email verification | None | `POST /auth/verification/request`, `POST /auth/verification/confirm` with the link's token as `code`. Login answers `verification_required` until then. v2.16.0+ ([Verify account][verify-guide]) | ADR 0004, decision 5 |
| "Avísame" | Screen-only confirmation | `POST /store/restock-requests` with `{ variant_id, email }` | ADR 0007, decision 4 |
| Rate table on `/envios-y-devoluciones` | Storefront constant `SHIPPING_RATES` | `GET /store/shipping-rates` | [ubigeo-shipping](data-model/ubigeo-shipping.md) |
| Delivery estimate at checkout | Storefront `quoteShipping` and `deliveryWindow` | `GET /store/carts/:id/delivery-estimate` | ubigeo-shipping |
| Criteria on `/como-elegimos` | Storefront constant `RUBRIC_CRITERIA` | `GET /store/review-rubrics` (proposed) | [editorial](data-model/editorial.md) |

## Custom routes

Paths marked "this map" are named here for the first time (proposed). The others repeat an ADR or data model page.

### Store

| Method | Path | Owner | Auth | Purpose | Source |
|---|---|---|---|---|---|
| GET | `/store/product-listings` | Catalog application code (specs, availability) | public | `ProductQuery` on the server; ordered product ids and `total` | This map; [specs](data-model/specs.md) listing |
| GET | `/store/product-specs` | specs | public | Resolved specs per product, batch `product_id` | This map; specs |
| GET | `/store/spec-schemas` | specs | public | Spec schema per category, batch `category_id` | This map; specs |
| GET | `/store/expert-reviews` | editorial | public | Expert review per product, batch `product_id` | This map; [editorial](data-model/editorial.md) |
| GET | `/store/review-rubrics` | editorial | public | Criteria per category for `/como-elegimos` | This map; editorial |
| GET | `/store/variant-availability` | Availability application code (`variantAvailability`) | public | `[{ variant_id, status, lead_time_days, max_quantity }]` | [ADR 0007](adr/0007-availability-mapping.md), decision 6 |
| POST | `/store/restock-requests` | procurement | public, throttled | "Avísame" for `unavailable` variants; same answer whether the email was there | ADR 0007, decision 4; [procurement](data-model/procurement.md) |
| GET | `/store/ubigeo` | ubigeo-shipping | public | The whole ubigeo tree | [ubigeo-shipping](data-model/ubigeo-shipping.md) |
| GET | `/store/shipping-rates` | ubigeo-shipping | public | Zone, price and transit days | ubigeo-shipping |
| GET | `/store/carts/:id/delivery-estimate` | ubigeo-shipping, with availability lead times | guest (cart id) | Delivery dates for the cart | ubigeo-shipping |
| POST | `/store/carts/:id/receipt` | sunat-billing | guest (cart id) | The contact step's DNI or CE with no type (C1), then boleta, or factura when enabled | [sunat-billing](data-model/sunat-billing.md) |
| GET | `/store/carts/:id/receipt` | sunat-billing | guest (cart id) | The cart's receipt request, to rebuild the draft | This map |
| GET | `/store/carts/:id/payment-reconciliation` | culqi | guest (cart id) | Whether the cart has an open reconciliation record | [ADR 0005](adr/0005-culqi-payments.md), decision 15; [culqi](data-model/culqi.md) |
| POST | `/store/order-tracking` | Order-tracking application code | public, throttled | Guest tracking by number and email | ADR 0002, decisions 3–5; path from this map |
| GET | `/store/order-confirmations/:order_id` | Order-tracking application code | guest (order id), first hour | Confirmation for the browser that paid | This map |
| GET | `/store/customers/me/orders` | Order-tracking application code | session | Account orders, guest orders by verified email included | [ADR 0004](adr/0004-customer-auth.md), decision 6; path from this map |
| GET, POST | `/store/customers/me/favorites` | `listFavorites`, `addFavoriteWorkflow` | session | List newest first; add `{ product_id }` | [customer favorites](data-model/customer-favorites.md) |
| DELETE | `/store/customers/me/favorites/:product_id` | `removeFavoriteWorkflow` | session | Remove one | customer favorites |
| POST | `/store/complaints` | complaints (`fileComplaintWorkflow`, `sendComplaintCopyWorkflow`) | public, throttled | File a Hoja de Reclamación | [ADR 0006](adr/0006-complaints-book.md), decision 3 |
| GET | `/store/complaints/:number` | complaints | guest (`x-complaint-access-token`), first hour | Constancia | ADR 0006, decision 3 |

Throttles (proposed where the source sets no number): tracking keeps F1's 10 failures per 15 minutes in the storefront and enforces it in the backend route too, counted in Redis per client IP and per email, with the client IP trusted only from the storefront server. With Redis down, the route fails closed and answers 429 (ADR 0002, decision 5). Complaints: 5 filings per hour per client key in the storefront, 30 per hour per source IP in Medusa (ADR 0006). "Avísame": the complaints numbers (this map). See open item C5.

### Admin

Every `/admin` route requires an authenticated admin user ([Protected routes][protected]).

| Method | Path | Owner | Purpose | Source |
|---|---|---|---|---|
| GET | `/admin/complaints` | complaints | List; filters `state`, `overdue`, `year`, `q` | ADR 0006, decision 6 |
| GET | `/admin/complaints/:id` | complaints | Sheet, answers, delivery status | ADR 0006 |
| POST | `/admin/complaints/:id/answers` | `answerComplaintWorkflow` | Append an answer | ADR 0006 |
| POST | `/admin/complaints/:id/copy` | complaints | Resend the copy now | ADR 0006 |
| POST | `/admin/complaints/:id/answers/:answer_id/send` | complaints | Retry an email answer | ADR 0006 |
| GET, POST | `/admin/suppliers` | procurement | List, create | procurement |
| POST | `/admin/suppliers/:id` | procurement | Edit | procurement |
| GET, POST | `/admin/supplier-offers` | procurement | Offers per variant | procurement |
| POST | `/admin/supplier-offers/:id` | procurement | Edit an offer | procurement |
| GET | `/admin/procurement-items` | procurement | Purchase queue, `pending` first by `expected_by` | procurement |
| POST | `/admin/supplier-purchases` | `recordSupplierPurchaseWorkflow` | Record a purchase with its items | procurement; [procurement item](state-machines/procurement-item.md) |
| POST | `/admin/supplier-purchases/:id/costs` | procurement | Later freight, duty or fee invoice | procurement |
| POST | `/admin/supplier-purchases/:id/fail` | `failSupplierPurchaseWorkflow` | Purchase failed | procurement |
| POST | `/admin/procurement-items/dispatch` | `recordDispatchWorkflow` | Dispatch | procurement |
| POST | `/admin/procurement-items/receive` | `receiveProcurementItemsWorkflow` | Reception | procurement |
| GET | `/admin/restock-requests` | procurement | Demand per variant | procurement |
| GET | `/admin/comprobantes` | sunat-billing | Pending to issue, then the rest | sunat-billing |
| POST | `/admin/comprobantes/:id/issue` | sunat-billing | Record a manual issuance | sunat-billing |
| POST | `/admin/comprobantes/:id/answer` | sunat-billing | SUNAT answer | sunat-billing |
| POST | `/admin/comprobantes/:id/void` | sunat-billing | Baja | sunat-billing |
| GET | `/admin/regime` | sunat-billing | The four Nuevo RUS meters and the flags, read-only | sunat-billing; [ADR 0008](adr/0008-regime-flags.md) |
| GET | `/admin/culqi-reconciliations` | culqi | Records, open first | culqi |
| POST | `/admin/culqi-reconciliations/:id/resolve` | culqi | Close with a note | culqi |
| GET, POST | `/admin/spec-schemas` | specs | List schemas with definitions; create a category's schema | This map; specs |
| POST | `/admin/spec-schemas/:id/definitions` | specs | Add a definition | This map |
| POST, DELETE | `/admin/spec-definitions/:id` | specs | Edit or delete; `kind` and `key` locked while values exist | This map; specs |
| GET, POST | `/admin/product-spec-sheets/:product_id` | specs (`upsertSheet`) | Read and replace a product's values | This map |
| GET, POST | `/admin/review-rubrics` | editorial | List rubrics; create a category's rubric | This map; editorial |
| POST | `/admin/review-rubrics/:id/criteria` | editorial | Add a criterion | This map |
| POST, DELETE | `/admin/rubric-criteria/:id` | editorial | Edit or delete; delete refused while a score uses it | This map; editorial |
| GET, POST | `/admin/expert-reviews/:product_id` | editorial (`upsertReview`) | Read and replace a product's review | This map; editorial |

The specs and editorial editors were pending since F1 (Engram #107); editorial says their routes belong here. No admin routes for transit times and holidays in the MVP: the seed writes them (proposed). Alternative: an editor like the specs one.

### Hooks

| Method | Path | Owner | Auth | Purpose | Source |
|---|---|---|---|---|---|
| POST | `/hooks/payment/culqi_culqi` | Medusa's payment webhook route, provider `getWebhookActionAndData` | None. Culqi signs nothing, so the body is never trusted. While the handler only logs (MVP), it makes no Culqi call; a later phase fetches the event with the secret key after deduplicating and rate-limiting | Log the event id and claimed type; answers `not_supported` in the MVP | ADR 0005, decision 10 |

### Middlewares and hooks on standard routes

| Route | Guard | Source |
|---|---|---|
| `GET /store/orders/:id` | Signed-in owner only (the guide's `authenticate` plus owner check) | [Restrict order retrieval][secure-order]; Engram #121; this map |
| `POST /auth/customer/emailpass`, `POST /auth/customer/emailpass/register` | Failed sign-ins, counted in Redis: 10 per 15 minutes per client IP plus email, 20 per email from any IP, 50 per client IP. Registrations: 10 per 15 minutes per client IP. A credentialed request without a forwarded IP skips the per-IP counts and alerts the owner; with Redis down, sign-in is refused | ADR 0004, decision 8 (proposed); client IP: C5 |
| `POST /auth/customer/emailpass/reset-password` | 3 per hour per email, 30 per hour per client IP. The throttled answer looks like Medusa's usual success. A completed reset clears that email's sign-in counters; an admin action can clear them too | ADR 0004, decision 8 (proposed); client IP: C5 |
| `POST /auth/customer/emailpass/register`, `POST /auth/customer/emailpass/update` | Password 8 to 128 characters | ADR 0004, decision 9 (proposed) |
| `POST /store/customers/me/addresses` | At most 10 addresses | ADR 0004, decision 9 (proposed) |
| Add to cart, update line, complete | `validate` hooks: quantity, availability, `allow_backorder` on items | ADR 0007, decision 5 |
| Complete | `validate` hooks: session amount and email (ADR 0005, step 6), address and shipping zone (ubigeo-shipping, step 5), receipt request (sunat-billing) | ADR 0005; ubigeo-shipping; sunat-billing |
| `POST /store/carts/:id/complete` | Payment attempts, counted in Redis: 10 per cart and 30 per client IP per hour. Over the cap: 429 before any Culqi call. A credentialed request without a forwarded IP skips the per-IP count and alerts the owner; with Redis down, the cap fails open and alerts after 5 minutes | ADR 0005, decision 4 (proposed); client IP: C5 |

## Open items

### Conflicts and gaps between documents

| # | Documents | Issue | Proposed |
|---|---|---|---|
| C1 | F1 checkout draft vs [sunat-billing](data-model/sunat-billing.md) | F1 collects the buyer's DNI or CE at the contact step. The data model stores it only in `receipt_request`, written at the receipt step. Between both steps the document has no home, and `get(cartId)` cannot rebuild `contact.customer.document` | **Decided 2026-11-13 (D5):** the contact step writes the receipt request with the document and name, and `receipt_request.type` stays null until the receipt step. A factura replaces the document with the RUC. The sunat-billing data model is updated. Rejected: moving the document field to the receipt step, because it changes the F1 checkout |
| C2 | [ADR 0004](adr/0004-customer-auth.md), decision 5 vs F1 registration | The customer is created at the first login after verification, but F1 asks first and last name at registration. Nothing says where the names wait | **Decided 2026-11-13 (D6):** create the customer at registration with the registration token, keeping the F1 form. Whether Medusa allows it while verification is pending is an F3 spike; if not, the first sign-in asks the names. Rejected as the default: asking the names at the first sign-in, because it changes the F1 registration |
| C3 | F1 `PendingPayment` vs [ADR 0005](adr/0005-culqi-payments.md), decision 15 | F1's `reference` is the reserved order number. With Medusa, an orphan charge has no order | **Decided 2026-11-13 (D7):** drop the reference. The ADR 0005 pending copy needs none, and the owner finds the case by cart and email. F4 removes `PendingPayment.reference`. Rejected: showing the Culqi `charge_id`, because it does not always exist and exposes a provider identifier |
| C4 | F1 `CustomerAccount.document` vs the data model and the [seed plan](seed-plan.md) | The account's DNI or CE has no home: no Medusa customer field, no data model page, and metadata is ruled out (Engram #18). Checkout keeps the document per cart, in sunat-billing `receipt_request`. The seed plan says F1 uses the account's document to prefill checkout; the F1 code does not: registration sets `null`, only the demo account has one, and no checkout code reads it (prefill from the account is pending since F1, Engram #107) | **Decided 2026-11-13 (D8):** `CustomerAccountRepository` reads `document` as `null` and never writes it; the checkout ports take the document from the cart's receipt request (C1). F4 drops the field. Rejected: a small custom model linked to the customer for checkout prefill, because it adds a model, a link, routes and personal data to protect for a convenience F1 never shipped |
| C5 | ADR 0006, decision 3 (and the "Avísame" and tracking throttles), ADR 0004, decision 8 (sign-in) and ADR 0005, decision 4 (payment attempts) vs server-side calls (ADR 0004) | Every customer request reaches Medusa from the storefront server's address. A per-IP limit in Medusa then becomes a store-wide cap, which ADR 0006 rejects ("No global cap") | **Decided 2026-11-13 (D9).** The storefront forwards the client IP, and Medusa trusts `X-Forwarded-For` only from callers with the storefront's server credential (a secret header). Any other caller is counted by its own address. Rejected: limits only at the storefront or the edge, because a direct caller to Medusa would bypass them. Exempting the storefront server from per-IP limits is not enough: sign-in and payment run only through it, so their per-IP caps would never apply. The credential and the forwarding ship with the sign-in middleware as one F3 unit (ADR 0004, decision 8), and before Culqi live keys (ADR 0005, decision 3). A credentialed request without a forwarded IP skips its per-IP counts, never keyed on the storefront server's address, and alerts the owner. Joins the ADR 0006 spike on the client IP |
| C6 | ADR 0004, decision 9 vs [customer favorites](data-model/customer-favorites.md) | The ADR keeps the 100-favorite limit on the server; the data model accepts a race that reaches 101 | **Decided 2026-11-13 (D10):** keep the data model's choice. The limit stops unbounded growth, and 101 harms no one. Rejected: a lock per customer, which needs a multi-instance Locking Module provider for a marginal case |

### Not verified (F3 spikes)

- Whether the store product routes return linked custom data through `fields` (specs, editorial). If yes, two batch routes go away.
- Whether `q` on `GET /store/products` is accent-insensitive.
- Whether the store routes sort categories by `rank` and products by calculated price. Price sort would shrink the listing route.
- The query-string form of the nested `variants.sku` filter.
- Whether completion requires `billing_address`.
- Whether a new login is needed after `POST /store/customers` so the session carries the customer id.
- Custom routes nested under `/store/carts/:id` next to Medusa's own cart routes.
- What `GET /store/carts/:id` and `POST /store/carts/:id/complete` return for a completed cart. Medusa treats the cart id as the credential, so a leaked id could read the order. The storefront drops `mg_cart` after completion; locking completed carts is not proposed for the MVP.
- Throttling middleware on `/auth/*` routes (ADR 0004, decision 8).
- ADR 0005 spikes S1–S10 and the data model spikes still apply.

### Proposed points for owner review

| # | Choice | Alternative |
|---|---|---|
| P1 | Only the Next.js server calls Medusa, through the JS SDK | `fetch` with the same headers |
| P2 | Product data from the standard routes; specs, reviews and availability from batch custom routes; listings through `GET /store/product-listings` | One composed route, or the standard route with filters in the adapter |
| P3 | `featured` is creation order (`created_at` ascending), which the seed makes F1 order | An explicit rank model or link |
| P4 | Facets stay in the storefront (F1 `computeFacets`) | Specs module `computeFacets` behind the listing route |
| P5 | Cart and account ports split into operations in F4 | Keep `save` and diff in the adapter |
| P6 | The contact step adds the zone's only shipping option; `billing_address` copies the shipping address | A shipping choice step |
| P7 | Order view routes: tracking by POST body, confirmation by order id for one hour, account list by session | Tracking by GET query; no confirmation route (always ask the email) |
| P8 | Account order detail keeps the F1 confirmation path | `GET /store/customers/me/orders/:number` |
| P9 | `GET /store/orders/:id` locked to signed-in owners | `allowUnauthenticated` plus an email check |
| P10 | `emailVerifiedAt` is the customer's `created_at` | Drop the field from the Medusa path |
| P11 | No cart transfer after sign-in | Set the cart's customer after sign-in |
| P12 | Region id from storefront configuration | `GET /store/regions` at startup |
| P13 | `GET /store/carts/:id/receipt` added to sunat-billing | Read the link through cart `fields`, if the spike allows it |
| P14 | Names of the new custom routes in this map, and the error codes `shipping_address_invalid` and `payment_session_mismatch` | Other names; owner preference |
| P15 | F1 `model` maps to the product `subtitle` (seed plan) | A "Modelo" spec in every schema, or no field |
| P16 | The account's `document` is dropped from the Medusa path (C4) | A custom model linked to the customer |

[pak]: https://docs.medusajs.com/resources/troubleshooting/storefront-missing-pak
[protected]: https://docs.medusajs.com/learn/fundamentals/api-routes/protected-routes
[errors]: https://docs.medusajs.com/learn/fundamentals/api-routes/errors
[get-order]: https://docs.medusajs.com/api/store/orders/get-an-order
[list-orders]: https://docs.medusajs.com/api/store/orders/list-orders
[secure-order]: https://docs.medusajs.com/resources/commerce-modules/order/secure-order-retrieval
[list-products]: https://docs.medusajs.com/api/store/products/list-products
[list-categories]: https://docs.medusajs.com/api/store/product-categories/list-product-categories
[list-collections]: https://docs.medusajs.com/api/store/collections/list-collections
[list-regions]: https://docs.medusajs.com/api/store/regions/list-regions
[create-cart]: https://docs.medusajs.com/api/store/carts/create-cart
[update-cart]: https://docs.medusajs.com/api/store/carts/update-a-cart
[update-cart-guide]: https://docs.medusajs.com/resources/storefront-development/cart/update
[add-line]: https://docs.medusajs.com/api/store/carts/add-line-item
[update-line]: https://docs.medusajs.com/api/store/carts/update-line-item
[remove-line]: https://docs.medusajs.com/api/store/carts/remove-line-item
[add-shipping]: https://docs.medusajs.com/api/store/carts/add-shipping-method
[complete-cart]: https://docs.medusajs.com/api/store/carts/complete-cart
[cart-options]: https://docs.medusajs.com/api/store/shipping-options/list-shipping-options-for-cart
[create-collection]: https://docs.medusajs.com/api/store/payment-collections/create-payment-collection
[init-session]: https://docs.medusajs.com/api/store/payment-collections/initialize-payment-session
[update-session]: https://docs.medusajs.com/api/store/payment-collections/update-payment-session
[line-item]: https://docs.medusajs.com/resources/references/cart/models/LineItem
[register-customer]: https://docs.medusajs.com/api/store/customers/register-customer
[get-customer]: https://docs.medusajs.com/api/store/customers/get-customer
[update-customer]: https://docs.medusajs.com/api/store/customers/update-customer
[create-address]: https://docs.medusajs.com/api/store/customers/create-address
[update-address]: https://docs.medusajs.com/api/store/customers/update-address
[remove-address]: https://docs.medusajs.com/api/store/customers/remove-address
[register-guide]: https://docs.medusajs.com/resources/storefront-development/customers/register
[verify-guide]: https://docs.medusajs.com/resources/storefront-development/customers/verify-account
[login-guide]: https://docs.medusajs.com/resources/storefront-development/customers/login
[reset-guide]: https://docs.medusajs.com/resources/storefront-development/customers/reset-password
[reset-token]: https://docs.medusajs.com/api/store/auth/generate-reset-password-token
[reset-password]: https://docs.medusajs.com/api/store/auth/reset-password
