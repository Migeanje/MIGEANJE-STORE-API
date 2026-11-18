# F3a — Medusa base and catalog

- Objective: first code phase. Proportionality pass over ADRs 0004–0008, local Windows environment without Docker, Medusa 2.22.1+ scaffold in the repository root, Peru region and sales setup, the specs, editorial and ubigeo-shipping modules (test-first), and an idempotent seed.
- Branch and delivery: one branch and one PR per slice to `main`, Conventional Commits, no AI attribution, squash merge by the owner. Each slice branches from the latest `origin/main`; if the previous PR is still open, the new branch starts from it and later merges `main` in (never rebase plus force push).
- Test runner: Medusa's Jest setup (exact commands confirmed in T3 from the official docs). Engram mirror: project `migeanje-store`, topic `odd/f3a-medusa-base-catalog/tasks`. Inputs: Engram #30, #548, #561 (newest wins on conflict).

## Specs

- S0 — Inputs: read Engram #30 (master summary), #548 (F2 close) and #561 (approved resolutions and F3 plan) in full, in that order. "Si una memoria contradice a otra, gana la más nueva." Design documents live in `docs/` (ADRs, data model, contract map, seed plan). "Verifica todo lo de Medusa v2 en su documentación oficial (context7), sin depender de tu memoria."
- S1 — "Pasada de proporcionalidad (R13 de #561): clasifica cada mecanismo de los ADRs 0004–0008 como "MVP" o "cuando el volumen lo pida", con un disparador concreto, y registralo en un ADR nuevo. Contexto: el NRUS limita a ~55–80 pedidos por mes. La protección contra cobros dobles no se negocia. Decidimos mecanismo por mecanismo, uno a la vez conmigo."
- S2 — "Entorno local en Windows, sin Docker: Node LTS compatible con Medusa, pnpm, PostgreSQL nativo y Redis dentro de WSL2 (R12). Guíame en lo que tenga que instalar yo y documéntalo en docs/dev-setup.md."
- S3 — "Medusa 2.22.1 o posterior instalado en la raíz de este repo, SIN perder docs/ ni odd/. Más Biome, CI con GitHub Actions (lint, typecheck, tests), .nvmrc y un CLAUDE.md con las convenciones del repo."
- S4 — "Región Perú, PEN, precios con IGV incluido, canal de venta y ubicación de stock."
- S5 — "Módulos specs, editorial y ubigeo-shipping (con la tabla de feriados), según docs/data-model/, con test-first."
- S6 — "Seed idempotente según docs/seed-plan.md."
- S7 — Way of working: "rama + PR por porción, Conventional Commits, sin atribución de IA. Podés pushear ramas de trabajo; los merges los hago yo con squash. Máximo una ronda de revisión (más una corrección) por porción: lo que aparezca después va a pendientes (R14)."
- S8 — Close: "Al cerrar, guarda en Engram (proyecto migeanje-store) un resumen de cierre de F3a con el mismo formato que la #548 y dime su número."

## Tasks

Route legend: inline = parent writes; delegated = one bounded writer (Writer trigger reason recorded).

- [x] T1 — S1. Slice `docs/f3a-proportionality`: ADR 0009 proportionality pass, decided one mechanism at a time with the owner; this document. Route: inline (interactive owner decisions). Mechanism inventory mapped by one read-only explorer (Mapping trigger: ADRs 0004–0008 are ~18k words). Outcome: 42 mechanisms, 42 owner decisions (27 MVP, 1 MVP only if ADR 0005 spike S1 fails, 11 MVP with a deferred part, 3 deferred). Commits: `beaf8e6`, `30eec20`, `a03adb1` (R14 correction). PR #4. Review: assessed `high` (auth and payments paths), one round with risk and readability lenses, approved with 3 advisory findings, all fixed in the correction (L7).
- [ ] T2 — S2. Slice `docs/f3a-dev-setup`: guide the owner through installs; `docs/dev-setup.md`. Route: inline.
- [ ] T3 — S3. Slice `chore/f3a-medusa-scaffold`: Medusa 2.22.1+ in the root keeping `docs/` and `odd/`, Biome, GitHub Actions CI (lint, typecheck, tests), `.nvmrc`, `CLAUDE.md`. Route: inline. Risk: item 5 (dependencies, CI).
- [ ] T4 — S4. Slice `feat/f3a-region-peru`: Peru region, PEN, IGV-inclusive prices, sales channel, stock location. Route: inline.
- [ ] T5 — S5. Module `specs`, test-first. Route: decided at T5 start (Writer trigger (a) may apply to T5–T7).
- [ ] T6 — S5. Module `editorial`, test-first. Route: decided at T5 start.
- [ ] T7 — S5. Module `ubigeo-shipping` with the holiday table, test-first. Route: decided at T5 start.
- [ ] T8 — S6. Slice `feat/f3a-seed`: idempotent seed per `docs/seed-plan.md`. Route: inline.
- [ ] T9 — S8. Engram closing summary in project `migeanje-store`, same format as #548; report its number.

## Pending (R14)

Findings that appear after a slice's single review round (plus one correction) land here.

## Log

- L1 (2026-11-17) — Owner's original request, verbatim:

  > Busca en Engram el proyecto "migeanje-store" y lee completas, en este orden:
  > #30 (resumen maestro), #548 (cierre de F2) y #561 (resoluciones aprobadas
  > y plan de F3). Si una memoria contradice a otra, gana la más nueva.
  > Los documentos de diseño están en docs/ de este repo (ADRs, modelo de
  > datos, mapa de contratos, plan de seed).
  >
  > Esta conversación es la fase F3a: base de Medusa + catálogo. Es la
  > primera fase con código. Verifica todo lo de Medusa v2 en su
  > documentación oficial (context7), sin depender de tu memoria.
  >
  > Entregables, en este orden:
  > 1. Pasada de proporcionalidad (R13 de #561): clasifica cada mecanismo de
  >    los ADRs 0004–0008 como "MVP" o "cuando el volumen lo pida", con un
  >    disparador concreto, y registralo en un ADR nuevo. Contexto: el NRUS
  >    limita a ~55–80 pedidos por mes. La protección contra cobros dobles no
  >    se negocia. Decidimos mecanismo por mecanismo, uno a la vez conmigo.
  > 2. Entorno local en Windows, sin Docker: Node LTS compatible con Medusa,
  >    pnpm, PostgreSQL nativo y Redis dentro de WSL2 (R12). Guíame en lo que
  >    tenga que instalar yo y documéntalo en docs/dev-setup.md.
  > 3. Medusa 2.22.1 o posterior instalado en la raíz de este repo, SIN perder
  >    docs/ ni odd/. Más Biome, CI con GitHub Actions (lint, typecheck,
  >    tests), .nvmrc y un CLAUDE.md con las convenciones del repo.
  > 4. Región Perú, PEN, precios con IGV incluido, canal de venta y ubicación
  >    de stock.
  > 5. Módulos specs, editorial y ubigeo-shipping (con la tabla de feriados),
  >    según docs/data-model/, con test-first.
  > 6. Seed idempotente según docs/seed-plan.md.
  >
  > Forma de trabajo: rama + PR por porción, Conventional Commits, sin
  > atribución de IA. Podés pushear ramas de trabajo; los merges los hago yo
  > con squash. Máximo una ronda de revisión (más una corrección) por
  > porción: lo que aparezca después va a pendientes (R14).
  > Al cerrar, guarda en Engram (proyecto migeanje-store) un resumen de
  > cierre de F3a con el mismo formato que la #548 y dime su número.

- L2 (2026-11-17) — Inputs read: #30, #548, #561. No contradictions; #561 R12 (Redis required locally, inside WSL2) supersedes "Redis optional in dev" from Block 1. `main` is at `03f4128` (PR #3 merged). `gh` is not logged in on this machine: pushing branches works through git, but opening PRs needs `gh auth login` by the owner.
- L3 (2026-11-17) — T1 started: explorer inventories mechanisms in ADRs 0004–0008.
- L4 (2026-11-17) — Environment probe: Node v24.19.0 and pnpm 12.8.1 installed; no PostgreSQL; WSL has only the `docker-desktop` distro (stopped), no Linux distro for Redis; no Node version manager.
- L5 (2026-11-17) — Medusa docs (context7, docs.medusajs.com/learn/installation): Node v20.19.0+ or v22.12.0+, LTS only; PostgreSQL installed and running; `projectConfig.redisUrl` stores sessions in Redis, otherwise in memory. `create-medusa-app` (pnpm supported since v2.13.0) now scaffolds a monorepo with the backend in `apps/backend`; how that maps to "instalado en la raíz de este repo" is a T3 decision.
- L6 (2026-11-17) — T1 done. The owner decided the 42 mechanisms one at a time, all on the recommended option. Departures from the F2 designs: daily payment report instead of the 15-minute job (M20–M22, and the `culqi` module deferred, M10); webhook log only (M18); no admin unlock (M6); complaint retry job deferred (M29) and storefront filing throttle deferred (M25); flood alert deferred (M32); Telegram without n8n (M33, changes #30); no per-variant procurement lock (M38); regime settings page deferred (M40); cap check daily instead of hourly (M42). New number set by the owner: "Avísame" throttle 10 per hour per IP (M37). ADRs 0004–0008 now point to ADR 0009 under their status line; `docs/README.md` indexes it.
- L7 (2026-11-17) — T1 review (one round, R14): approved with 3 advisory readability findings, fixed in the single allowed correction. (1) M20 and M21 were labelled "Deferred" although the MVP builds the daily report: relabelled "MVP with a deferred part" (counts now 27 / 1 / 11 / 3). (2) "S1" collided with spec S1: ADR 0009 and T1 now say "ADR 0005 spike S1". (3) M25's "more than 10 filings in one hour" trigger now says how the owner sees it (per-sheet alerts of M32, since the flood alert is deferred).
- L8 (2026-11-17) — T2 in progress. Owner installed Ubuntu 24.04 in WSL2 and Redis; Windows reaches it on `localhost:6379` through `wslrelay`. Existing PostgreSQL found: the owner's Odoo environment runs a portable PostgreSQL 16.15 by hand on port 5433 (not a Windows service, not on PATH); every Odoo config pins `db_port = 5433` and its own `pg_path`. Decision: PostgreSQL 17 for Medusa on port 5432 as a separate Windows service; the Odoo server is untouched.
- L9 (2026-11-17) — `winget install --id PostgreSQL.PostgreSQL.17 --exact` runs the EnterpriseDB installer silently (manifest switches `--mode unattended --unattendedmodeui none`, no `--superpassword`): no prompt for password or port. Result: service `postgresql-x64-17` (Automatic, running), PostgreSQL 17.12, port 5432, superuser `postgres` with the installer default password `postgres`, `listen_addresses = *` but `pg_hba.conf` only accepts 127.0.0.1 and ::1 (scram-sha-256). The owner changes the password with `\password` in psql.
- L10 (2026-11-17) — T1 PR opened: https://github.com/Migeanje/MIGEANJE-STORE-API/pull/4. WSL ends a distro 15 seconds after its last WSL process exits (`instanceIdleTimeout`, default 15000 ms, per learn.microsoft.com/windows/wsl/wsl-config); systemd services do not keep it alive, and nothing starts it after a Windows restart. Owner chose "Un comando al arrancar": `%UserProfile%\.wslconfig` with `[general] instanceIdleTimeout=-1` (created), plus `wsl -d Ubuntu-24.04 -e true` after every restart. Verified: `gh` logged in (scopes repo, workflow), PostgreSQL bin on the user PATH, default `postgres` password rejected, Redis 7.0.15 answers PONG from Windows. `docs/dev-setup.md` drafted; pending check: Redis still up with no Ubuntu terminal open after `wsl --shutdown`.
