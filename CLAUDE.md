# CLAUDE.md

Conventions for working in this repository. Migeanje Store's commerce backend: a standalone Medusa v2 application at the repository root, with custom modules. The storefront lives in `MIGEANJE-STORE-APP`.

## Before you start

1. Read the task's tracking document in `odd/tasks/` (specs, tasks, log) if one exists.
2. Read the design that governs the change: `docs/adr/`, `docs/data-model/`, `docs/contract-map.md`, `docs/state-machines/`, `docs/seed-plan.md`.
3. **Check ADR 0009 before building any mechanism from ADRs 0004–0008.** It says which ones the MVP builds and which wait for a volume trigger. Build the MVP column only.
4. Verify every Medusa API against its documentation (see "Medusa sources of truth"), never from memory.

## Where things live

| Path | Holds |
|---|---|
| `src/modules/<name>/` | Custom modules: data models, service, migrations, `__tests__/` |
| `src/api/` | File-based routes: `src/api/store/<path>/route.ts`, `src/api/admin/<path>/route.ts`; middlewares in `src/api/middlewares.ts` |
| `src/workflows/`, `src/subscribers/`, `src/jobs/`, `src/links/` | Workflows, event subscribers, scheduled jobs, module links |
| `src/scripts/` | Scripts run with `medusa exec` (the seed) |
| `src/admin/` | Admin dashboard extensions |
| `integration-tests/http/` | HTTP integration tests |
| `docs/` | Design: ADRs, data model, contract map, state machines, seed plan, `dev-setup.md` |
| `odd/tasks/` | Progress tracking per phase |

## Commands

The package manager is pnpm (`packageManager` in `package.json`). Never create another lockfile.

| Command | Does |
|---|---|
| `pnpm dev` | Development server on `http://localhost:9000`, admin at `/app` |
| `pnpm build` | Production build into `.medusa/` |
| `pnpm lint` | Biome, then Medusa's ESLint rules (`medusa lint`) |
| `pnpm format` | Biome format and safe fixes |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | All three suites below |
| `pnpm test:unit` | `src/**/__tests__/**/*.unit.spec.ts` |
| `pnpm test:integration:modules` | `src/modules/*/__tests__/**` |
| `pnpm test:integration:http` | `integration-tests/http/*.spec.ts` |
| `pnpm medusa db:generate <module>` | Migration for a changed custom module model |
| `pnpm medusa db:migrate` | Run pending migrations |

Run one test: `pnpm test:unit <path>` or `pnpm test:unit -t "<name>"`. Do not add `--`: pnpm passes it on to Jest, which then reads `-t` and the name as file path patterns, so the wrong tests run (or none, and the suite still passes).

Integration tests need PostgreSQL running; `.env.test` holds its credentials. Local setup, including starting Redis inside WSL after a Windows restart: `docs/dev-setup.md`.

## Medusa sources of truth

In order:

1. **The installed package's `AGENTS.md`**: its public API, examples and gotchas for the exact installed version. Find them with `find node_modules -maxdepth 6 -path "*/@medusajs/*/AGENTS.md"`.
2. **The official docs** at `docs.medusajs.com`, through Context7 or by appending `.md` to a page URL.

Import from `@medusajs/framework/*` subpaths (`/utils`, `/types`, `/http`, `/workflows-sdk`), not from `@medusajs/utils` and similar packages directly.

## Code conventions

- **Lint must pass both tools.** Never disable a `@medusajs/*` ESLint rule to make lint pass: those rules encode framework requirements (route, workflow, module and link shapes). Fix the code.
- **Treat Medusa lint warnings as defects.** `medusa lint` fails only on errors; its warnings (for example `use-medusa-error-not-generic-error`, `prices-in-major-units`) still print and must be fixed before a change is done.
- **Style.** Enforced by Biome: no semicolons, double quotes, 2-space indent. Files in kebab-case; types and classes in PascalCase; functions and variables in camelCase; database columns in snake_case.
- **Routing is file-based.** Never register routes by hand.
- **Business logic lives in workflows.** Routes resolve and run a workflow.
- **Mutate commerce data through `@medusajs/medusa/core-flows` workflows**, not raw module service calls, so links, events and inventory stay consistent.
- **Custom modules keep their domain logic free of framework details** (hexagonal inside the module).
- **Money** follows ADR 0001: integer céntimos with currency in the storefront; `bigNumber` plus lowercase `currency_code` in Medusa.
- **Test first.** Write a failing test for each rule before the code, especially for money and module services.
- **Language.** Code, comments, commits and technical docs in English. Customer-facing copy in neutral Peruvian Spanish using "tú".

## Git workflow

- One branch and one pull request per work slice. The owner merges with squash.
- Conventional Commits. No AI attribution in commits, pull requests or files.
- At most one review round, plus one bounded correction, per slice. Later findings go to the "Pending" list of the tracking document.
- Record each slice's progress and commits in its `odd/tasks/` document.

## Off-limits

- `.env`, `.env.test` and any other env file: never read, print or commit them. The variables are documented in `docs/dev-setup.md`.
- `.medusa/`, `node_modules/`: generated. Read package `AGENTS.md` files there; never edit installed packages.
- `pnpm-lock.yaml`: change it only through pnpm commands.
- Existing migrations in `src/modules/*/migrations/`: add a new migration instead of editing one that may have run.
- Destructive database commands (drop, reset) on the owner's database: only with explicit confirmation.

## Common mistakes

- Editing a module model without `pnpm medusa db:generate <module>`: the change never reaches the database.
- Forgetting that Redis lives inside WSL: after a Windows restart it stays down until Ubuntu starts (`wsl -d Ubuntu-24.04 -e true`). From F3b on, sessions and the auth throttles need it.
- Building a deferred mechanism from ADRs 0004–0008 without checking ADR 0009.
