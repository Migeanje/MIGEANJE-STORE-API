# ADR 0002 — Order number: a formatting of Medusa's `display_id`

- Status: Accepted
- Date: 2026-11-04
- Deciders: Owner
- Related: Engram #107 (section 3, orders), #118 (R4), #121

## Context

- The F1 storefront numbers orders `MG-YYYY-NNNNNN`. `YYYY` is the year in America/Lima and `NNNNNN` is six **random** digits. Random numbers collide, and the mock cannot detect a collision across processes (R4).
- Customers type the number to track an order, together with their email. `normalizeOrderNumber` accepts lowercase, spaces and missing dashes. `ORDER_NUMBER_PATTERN` is `/^MG-\d{4}-\d{6}$/`.
- Medusa stores `display_id` on every order: "a serial integer that starts at 1 and increments with each new order". `display_id` is a searchable field, so the admin finds an order by it through the `q` parameter ([Custom Order Display ID](https://docs.medusajs.com/resources/commerce-modules/order/custom-display-id)).
- Since v2.12, the Order Module option `generateCustomDisplayId` can fill `custom_display_id`, which has a unique index (same page). The function receives the order **creation input**, which carries no `display_id`. A yearly correlative would therefore need its own counter.

## Decision

1. **The order number is derived, not stored.** `MG-YYYY-NNNNNN`, where `YYYY` is the year of the order's `created_at` in America/Lima and `NNNNNN` is `display_id` padded with zeros to six digits. Example: `display_id` 412 created on 2026-12-31 at 23:30 Lima time (2027-01-01 04:30 UTC) is `MG-2026-000412`.
2. **No custom counter and no `custom_display_id`.** The Order Module keeps its defaults.
3. **One formatter and one parser, shared by everyone.**
   - Backend: the custom route that tracks a guest order and the order emails use the same formatter.
   - Storefront: the Medusa adapter formats the number from `display_id` and `created_at`. It keeps the F1 `normalizeOrderNumber` for user input.
4. **Lookup checks both parts.** The guest tracking route parses the number into a year and a `display_id`. It finds the order by `display_id` and returns it only when the Lima year of `created_at` matches and the email matches. Any mismatch answers "not found", the same answer as a wrong email.
5. **The number is never a credential.** Sequential numbers can be guessed. Guest tracking always requires the email, keeps the F1 throttle (10 failures per 15 minutes) and never reveals which of the two fields failed.
   - The backend tracking route enforces the throttle too, not only the storefront. The storefront's in-process counter alone could be bypassed by calling Medusa directly.
   - Failures are counted in Redis per client IP and per email. The client IP is trusted only on requests that carry the storefront server's credential, as ADR 0004 (decision 8) defines for sign-in. Any other caller is counted by its own address.
   - If Redis is unavailable, the route fails closed: it answers every lookup with the throttle answer (HTTP 429 and the F1 throttle copy) until Redis returns. Guest tracking is not needed to sell, and order numbers can be guessed, so an outage must not open unthrottled guessing.

## Consequences

- No collisions: the database assigns `display_id`. The number exists as soon as `completeCartWorkflow` creates the order, so the confirmation page and the confirmation email can show it immediately.
- The number does not reset each year. `MG-2027-000413` can follow `MG-2026-000412`. The year is informative and also serves as a typing check.
- The number reveals approximate order volume (accepted by the owner).
- The number is not gapless. It is not a fiscal document: boleta correlatives belong to the SUNAT series of the sunat-billing module.
- The Medusa admin lists orders as `#412`. An admin widget in the `order.details.side` zone shows the `MG-` number, and admin search by `412` works without changes.
- The format and the parser from F1 stay as they are. `formatOrderNumber` rejects sequences above 999999. When `display_id` approaches one million, the format and `ORDER_NUMBER_PATTERN` must widen to seven digits. No action is needed now.
- Storefront follow-up (F4): `OrderRepository.reserveNumber` has no Medusa equivalent. The Medusa adapter reads the number from the order that cart completion returns. The contract map (F2) defines the replacement.

## Alternatives considered

- **Own yearly correlative in `custom_display_id`.** Rejected: it needs an atomic counter in a custom module and a subscriber that writes the number after the order exists. Whether `custom_display_id` can be updated after creation is not verified, and the order would have no number while the subscriber runs, which delays the confirmation email.
- **Keep random digits with a uniqueness check.** Rejected: it adds retries and a unique index to solve a problem that `display_id` does not have.
