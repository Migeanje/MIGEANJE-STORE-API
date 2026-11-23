# Seed data

Typed data files for `src/scripts/seed.ts` (see `docs/seed-plan.md`, "Data sources").

- `categories.ts`, `brands.ts`, `products.ts`, `rubrics.ts`, `shipping.ts`, `demo.ts`: copied once from the storefront fixtures in `MIGEANJE-STORE-APP/src` (`modules/catalog/infrastructure/fixtures/`, `app/(transactional)/como-elegimos/rubric-criteria.ts`, `modules/checkout/domain/shipping.ts`, `modules/account/infrastructure/fixtures/demo-account.ts`). Prices stay in F1 integer céntimos; the Apple line has no prices (R9). The demo account has no password and no hash.
- `holidays.ts`: national holidays 2026 and 2027 (D.Leg. 713 art. 6 as amended by Ley 31788, plus Ley 31822). 2027 must be re-checked.
- `refund-reasons.ts`: ADR 0005, decision 11.
- `ubigeo-departamentos.ts`: INEI code, official spelling and ISO 3166-2:PE code of the 25 departamentos.
- `ubigeo-inei-2022.csv`: INEI's official ubigeo table, edition 2022 (1,891 distritos, 196 provincias, 25 departamentos).
  - Source: https://www.inei.gob.pe/media/DATOS_ABIERTOS/UBIGEOS/UBIGEOS_2022_1891_distritos.zip
  - License: Open Data Commons Open Database License (ODbL), as published by INEI.
  - Conversion: the original is Windows-1252 with `;` separators. It was decoded to UTF-8 once; the blank rows and the 16 footnote rows ("1/ SU CAPITAL LEGAL ES ...") were dropped, and the header was kept. No value was changed. The seed title-cases the names when it loads them.
