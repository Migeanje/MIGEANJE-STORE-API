# Migeanje Store — API

Commerce backend for Migeanje Store, a premium tech accessories shop for Peru. It runs on Medusa v2 with custom modules for specs, editorial content, procurement, complaints, shipping by ubigeo, SUNAT billing and Culqi payments.

## Quick start

Set up the machine once with [`docs/dev-setup.md`](docs/dev-setup.md) (Windows, no Docker). Then:

```bash
pnpm install
pnpm dev        # API on http://localhost:9000, admin on /app
pnpm lint       # Biome and Medusa's ESLint rules
pnpm typecheck
pnpm test       # needs PostgreSQL running
```

Working conventions for contributors and coding agents: [`CLAUDE.md`](CLAUDE.md).

## Layout

- `src/`: the Medusa application (custom modules, routes, workflows, subscribers, jobs, admin extensions).
- `integration-tests/`: HTTP integration tests.
- `docs/adr/`: architecture decision records. Cross-cutting decisions live here; storefront-only decisions live in the storefront repository.
- `docs/`: data model, contract map, state machines, seed plan and local setup.
- `odd/tasks/`: progress tracking for each phase.

## Related repositories

- `MIGEANJE-STORE-APP`: Next.js storefront.
- `MIGEANJE-STORE-ADMIN-APP`: reserved.

## Conventions

- Short-lived branches, one pull request per work slice, squash merge.
- Conventional Commits.
- Code, commits and technical docs in English. Customer-facing copy in neutral Peruvian Spanish using "tú".
