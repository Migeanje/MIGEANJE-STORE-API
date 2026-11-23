// Generated once from the storefront fixture modules/account/infrastructure/fixtures/demo-account.ts
// (MIGEANJE-STORE-APP/src); see docs/seed-plan.md, "Data sources".

import type { SeedDemoAccount } from "./types"

/**
 * The public demo account, without its password and hash: the password comes
 * from SEED_DEMO_PASSWORD. `favorites` is newest first, as in F1.
 */
export const DEMO_ACCOUNT: SeedDemoAccount = {
  email: "demo@migeanje.pe",
  firstName: "Lucía",
  lastName: "Demo",
  phone: "900000000",
  addresses: [
    {
      label: "Casa",
      line: "Av. José Pardo 500, dpto. 302",
      reference: "Cerca al óvalo Gutiérrez",
      distritoCode: "150122",
      distritoName: "Miraflores",
      isDefaultShipping: true,
    },
    {
      label: "Oficina",
      line: "Calle Mercaderes 210, oficina 4",
      reference: "",
      distritoCode: "040101",
      distritoName: "Arequipa",
      isDefaultShipping: false,
    },
  ],
  favorites: ["anker-prime-charger-100w-3-puertos", "soundcore-liberty-5"],
}
