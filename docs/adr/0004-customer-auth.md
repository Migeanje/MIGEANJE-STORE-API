# ADR 0004 — Customer auth: Medusa owns identity, the storefront holds a Medusa session

- Status: Accepted for points 1–4; points marked "(proposed)" are pending owner review
- Date: 2026-11-04
- Deciders: Owner
- Related: Engram #107 (section 3, account), #118 (R3), #121

## Context

- The F1 storefront runs its own auth stack behind ports: `CustomerAccountRepository`, `PasswordHasher` (scrypt with OWASP minimum parameters) and `SessionStore`. Sessions are opaque tokens that last 7 days (`SESSION_TTL_MS`). Sign-in failures are throttled to 10 per 15 minutes per client key, in process memory, which F1 itself calls "a best-effort guard". Passwords are 8 to 128 characters.
- F1 accounts carry `emailVerifiedAt`, but no flow sets it. The account's order list answers `email_unverified` until the email is verified, because it lists orders by email.
- R3: Medusa owns auth, sessions and hashing.
- Medusa offers two ways to stay signed in after `POST /auth/customer/emailpass` returns a JWT ([Login in storefront](https://docs.medusajs.com/resources/storefront-development/customers/login), [JS SDK auth](https://docs.medusajs.com/resources/js-sdk/auth/overview)):
  - **JWT**: sent as `Authorization: Bearer`. Logout only clears the stored token; "if the user still has access to the token, they can still send authenticated requests". `http.jwtExpiresIn` defaults to `1d`.
  - **Cookie session**: `POST /auth/session` with the JWT sets the session cookie. Logout destroys the session in Medusa. The docs name it the method for "a web storefront with Next.js".
- Session data lives in Redis when `redisUrl` is set; "otherwise, the session data is stored in-memory". `projectConfig.sessionOptions` (`name`, `ttl`, `rolling`) and `projectConfig.cookieOptions` (`sameSite`, `secure`, `httpOnly`, `maxAge`) configure it; the docs state no defaults ([Medusa config](https://docs.medusajs.com/learn/configurations/medusa-config)).
- Since v2.16, `http.authVerificationsPerActor` turns on email verification per actor type. With it on, login returns "an object indicating that verification is required" instead of a token until the email is verified. Registration only creates the auth identity; the customer is created at the first login after verification ([Email verification](https://docs.medusajs.com/resources/commerce-modules/auth/email-verification), [Verify account in storefront](https://docs.medusajs.com/resources/storefront-development/customers/verify-account)).

## Decision

1. **Medusa owns identity** (approved, R3). Customers authenticate with the `emailpass` provider. Medusa hashes passwords with scrypt. The F1 `PasswordHasher` and `SessionStore` ports have no Medusa adapter; they stay in the mock.
2. **Cookie session, held by the Next.js server** (approved, D4).
   - Sign-in runs in a Next.js server action: `POST /auth/customer/emailpass`, then `POST /auth/session` with the returned JWT. The JWT is used once and never stored.
   - The Next.js server keeps Medusa's session id in its own cookie on the storefront domain: `httpOnly`, `Secure`, `SameSite=Lax`, path `/`. Server-side calls to Medusa forward it as the session cookie. The browser never calls Medusa with credentials.
   - Logout calls `DELETE /auth/session`, which destroys the session in Medusa, then deletes the storefront cookie.
3. **Session lifetime: 7 days**, as in F1 (approved, D4). `sessionOptions.ttl` and the storefront cookie's `maxAge` are both 7 days. `rolling: false` (proposed): the session ends 7 days after sign-in, as in F1.
4. **Redis in production** (approved, D4). `redisUrl` is required in production so sessions survive restarts and are shared between instances. Development may keep in-memory sessions.
5. **Email verification is required to sign in** (proposed). `http.authVerificationsPerActor` is on for `customer` with `emailpass` and `entity_type: "email"`.
   - Registration sends the verification email (subscriber on `auth.verification_requested`, sent through Resend).
   - The first login after verification creates the customer (`POST /store/customers`), then opens the session.
   - A signed-in customer always has a verified email. The F1 `email_unverified` state disappears from the Medusa adapter.
   - Guest checkout does not change: guests never need an account.
6. **Guest orders in the account** (proposed). Because the email is verified, the account lists the orders placed with that email as a guest as well as the orders placed while signed in, as F1 intended. The contract map defines the route.
7. **Password reset** uses Medusa's reset flow: event `auth.password_reset`, a token valid for 15 minutes, email through Resend. The storefront page sets the new password with that token.
8. **Throttling** (proposed). A custom middleware limits failed sign-ins and registrations to 10 per 15 minutes per client key (IP plus email), counted in Redis. It answers with a generic message and never says whether the email exists. Applying custom middleware to `/auth/*` routes is not verified; F3 spike. The fallback is the same limit at the edge.
9. **Account limits** stay server-side: at most 10 addresses and at most 100 favorites (F1). Password length 8 to 128 is checked in the storefront and again by a middleware on registration and password update (proposed).

## Consequences

- Logout is a real revocation. A stolen storefront cookie stops working once its session is destroyed in Redis.
- Production needs Redis.
- Registration gains one step: the customer opens the verification email before the first sign-in. Copy: "Te enviamos un correo para confirmar tu cuenta. Ábrelo para iniciar sesión."
- An expired or invalid verification link sends the customer back to sign in, which sends a new email ([Verify account in storefront](https://docs.medusajs.com/resources/storefront-development/customers/verify-account)). The verification code lifetime is not documented; F3 spike.
- The verification event payload changed in v2.17 (`code_provider`, `entity_type`). The subscriber is written against the installed version.
- Favorites need a model. Metadata is not an option (no business data in metadata, Engram #18). The data model (T7) places them.
- Storefront follow-up (F4):
  - The Medusa adapter of `CustomerAccountRepository` maps to the register, verify, login and `/store/customers/me` routes.
  - `isEmailVerified` is always true for a Medusa session.
  - The sign-in page handles the "verification required" answer.
  - The demo account (`demo@migeanje.pe`) is seeded verified.

## Alternatives considered

- **JWT in an httpOnly cookie, sent as `Bearer` from the server.** Rejected by the owner: logout cannot revoke it, so a stolen token works until it expires.
- **Sessions without Redis.** Rejected: every restart signs everyone out, and two instances would not share sessions.
- **Custom verification that lets unverified customers sign in** (F1 behavior). Rejected: it needs a custom flag outside Medusa's auth, and every route that trusts the email would need to check it. Medusa's built-in verification gives the same guarantee with no custom state.
- **Rolling sessions.** Not chosen for now: F1 uses a fixed 7-day session. It is a one-line change if the owner prefers it.
