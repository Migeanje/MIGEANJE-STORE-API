# Local development setup (Windows, no Docker)

Medusa runs on Windows with Node.js, a native PostgreSQL service and Redis inside WSL2. Docker stays deferred (Engram #30). Redis is required locally because the auth throttles fail closed without it (ADR 0004, Engram #561 R12).

## What you need

| Tool | Version | Runs on | Port |
|---|---|---|---|
| Node.js | 24 LTS (`.nvmrc`) | Windows | — |
| pnpm | 12 | Windows | — |
| PostgreSQL | 17 | Windows service `postgresql-x64-17` | 5432 |
| Redis | 7 (Ubuntu package) | WSL2, distro `Ubuntu-24.04` | 6379 |
| GitHub CLI | any | Windows | — |

Why these versions:

- **Node.js.** `@medusajs/medusa` 2.22.7 declares `engines.node` `>=22.22.0`, stricter than the installation guide (v20.19+ or v22.12+, LTS only). The package wins. Node 24 is LTS and satisfies it.
- **PostgreSQL.** The Medusa docs set no minimum version; their Docker example uses 15. Version 17 is a conservative supported major.
- **Redis.** Ubuntu 24.04 ships Redis 7, the line Medusa's Docker example uses.

## Quick path

### 1. Ubuntu and Redis in WSL2

In PowerShell:

```powershell
wsl --install -d Ubuntu-24.04
```

It asks for a Linux user and password. Then, in the Ubuntu terminal:

```bash
sudo apt update && sudo apt install -y redis-server
sudo systemctl enable --now redis-server
redis-cli ping
```

`redis-cli ping` answers `PONG`. Ubuntu 24.04 on WSL runs systemd by default, so the service starts with the distro. Windows reaches it on `localhost:6379`.

### 2. Keep Ubuntu running

WSL shuts a distro down 15 seconds after its last terminal closes (`instanceIdleTimeout`, [WSL settings](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)); systemd services do not keep it alive. Redis stops with it.

Create `%UserProfile%\.wslconfig`:

```ini
[general]
instanceIdleTimeout=-1
```

The setting applies to every WSL distro and takes effect after `wsl --shutdown`.

**After every Windows restart**, start Ubuntu once before working:

```powershell
wsl -d Ubuntu-24.04 -e true
```

### 3. PostgreSQL 17

In PowerShell:

```powershell
winget install --id PostgreSQL.PostgreSQL.17 --exact
```

winget runs the EnterpriseDB installer silently (`--mode unattended`), so it asks nothing. The result:

- service `postgresql-x64-17`, automatic start, port 5432;
- superuser `postgres` with the installer's default password, **`postgres`**;
- connections accepted only from `127.0.0.1` and `::1` (`pg_hba.conf`).

Change the default password. In PowerShell:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost
```

Then, at the `postgres=#` prompt, run `\password postgres` and exit with `\q`. Keep the new password for your local `.env`.

Add the tools to your user `PATH`, then open a new terminal:

```powershell
$p = [Environment]::GetEnvironmentVariable("Path","User"); [Environment]::SetEnvironmentVariable("Path", "$p;C:\Program Files\PostgreSQL\17\bin", "User")
```

### 4. GitHub CLI

```powershell
gh auth login
```

Choose GitHub.com, HTTPS and the browser login. Pull requests are opened with `gh`.

### 5. Environment files

Create two files at the repository root. Both are git-ignored; never commit them. Replace every `<placeholder>`.

`.env`, for the development server:

```ini
DATABASE_URL=postgres://postgres:<password>@localhost:5432/migeanje_store
STORE_CORS=http://localhost:3000
ADMIN_CORS=http://localhost:5173,http://localhost:9000
AUTH_CORS=http://localhost:3000,http://localhost:5173,http://localhost:9000
JWT_SECRET=<long-random-string>
COOKIE_SECRET=<another-long-random-string>
SEED_DEMO_PASSWORD=<demo-password>
```

- `3000` is the storefront's Next.js dev server; `5173` and `9000` serve the Medusa admin.
- `SEED_DEMO_PASSWORD` is the password of the public demo account `demo@migeanje.pe` (8 to 128 characters). Only the seed's demo layer reads it; it refuses to run without it and when `NODE_ENV` is `production`.
- Generate each secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

`.env.test`, for the integration tests (the test runners create and drop their own databases on this server):

```ini
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<password>
```

### 6. Database and admin user

```powershell
pnpm install
pnpm medusa db:setup --db migeanje_store
pnpm medusa user -e <your-email> -p <admin-password>
```

`db:setup` creates the database, runs the migrations and syncs module links. Then seed it; the seed is idempotent, so running it again changes nothing:

```powershell
pnpm medusa exec ./src/scripts/seed.ts
pnpm medusa exec ./src/scripts/seed-check.ts
```

Without arguments the seed runs every layer, in this order: `reference` (ubigeo tree, holidays, refund reasons), `setup` (store, region, taxes, stock location, shipping, publishable API key), `catalog` (categories, brands, products, specs, rubrics, reviews) and `demo` (stock, demo customer and addresses). Name layers to run only those, for example `pnpm medusa exec ./src/scripts/seed.ts reference setup catalog` (what production runs: the demo layer is refused there). `seed-check.ts` is read-only, takes the same layer arguments and exits non-zero when a count or the Apple line check fails. The first run logs the public publishable API key; the storefront needs it.

Then `pnpm dev` serves the API on `http://localhost:9000` and the admin on `http://localhost:9000/app`.

## Check it works

Open a new PowerShell terminal:

| Command | Expected |
|---|---|
| `node -v` | `v24.x` |
| `pnpm -v` | `12.x` |
| `psql --version` | `psql (PostgreSQL) 17.x` |
| `psql -U postgres -h localhost -c "select 1"` | asks for your password, prints `1` |
| `wsl -d Ubuntu-24.04 -e redis-cli ping` | `PONG` |
| `gh auth status` | `Logged in to github.com` |

## Troubleshooting

- **Medusa cannot connect to Redis.** Ubuntu is not running, usually after a Windows restart. Run `wsl -d Ubuntu-24.04 -e true`.
- **`wsl` opens the wrong distro.** Docker Desktop may have made `docker-desktop` the default. Always pass `-d Ubuntu-24.04`, or run `wsl --set-default Ubuntu-24.04`.
- **psql warns about the console code page (850 vs 1252).** Harmless; it only affects how accented characters display in that console. Run `chcp 1252` before `psql` to silence it.
- **Another PostgreSQL already runs on this machine.** Keep it on its own port and data directory; Medusa's uses 5432. To reach the other one, pass its port, for example `psql -p 5433`. A `psql` 17 client connects to older servers.
