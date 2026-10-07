# Migeanje Store — API

Commerce backend for Migeanje Store, a premium tech accessories shop for Peru. It will run on Medusa v2 with custom modules for specs, editorial content, procurement, complaints, shipping by ubigeo, SUNAT billing and Culqi payments.

## Status

Design phase (F2). Medusa is installed in F3. Until then this repository holds the design:

- `docs/adr/`: architecture decision records. Cross-cutting decisions live here; storefront-only decisions live in the storefront repository.
- `docs/`: data model, contract map, state machines and seed plan.
- `odd/tasks/`: progress tracking for each phase.

## Related repositories

- `MIGEANJE-STORE-APP`: Next.js storefront.
- `MIGEANJE-STORE-ADMIN-APP`: reserved.

## Conventions

- Short-lived branches, one pull request per work slice, squash merge.
- Conventional Commits.
- Code, commits and technical docs in English. Customer-facing copy in neutral Peruvian Spanish using "tú".
