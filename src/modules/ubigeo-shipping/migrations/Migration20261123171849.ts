import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261123171849 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "ubigeo_distrito" drop constraint if exists "ubigeo_distrito_code_unique";`);
    this.addSql(`alter table if exists "ubigeo_provincia" drop constraint if exists "ubigeo_provincia_code_unique";`);
    this.addSql(`alter table if exists "ubigeo_departamento" drop constraint if exists "ubigeo_departamento_iso_3166_2_unique";`);
    this.addSql(`alter table if exists "ubigeo_departamento" drop constraint if exists "ubigeo_departamento_code_unique";`);
    this.addSql(`alter table if exists "holiday" drop constraint if exists "holiday_date_unique";`);
    this.addSql(`create table if not exists "delivery_estimate" ("id" text not null, "zone" text check ("zone" in ('lima_metro', 'callao', 'rest_of_peru')) not null, "transit_min_days" integer not null, "transit_max_days" integer not null, "lead_time_min_days" integer null, "lead_time_max_days" integer null, "delivery_from" text not null, "delivery_to" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "delivery_estimate_pkey" primary key ("id"), constraint delivery_estimate_transit_min_days_non_negative check (transit_min_days >= 0), constraint delivery_estimate_transit_max_gte_min check (transit_max_days >= transit_min_days), constraint delivery_estimate_lead_time_both_or_neither check ((lead_time_min_days IS NULL) = (lead_time_max_days IS NULL)), constraint delivery_estimate_lead_time_max_gte_min check (lead_time_max_days >= lead_time_min_days), constraint delivery_estimate_delivery_from_format check (delivery_from ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}\$'), constraint delivery_estimate_delivery_to_format check (delivery_to ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}\$'), constraint delivery_estimate_delivery_to_gte_from check (delivery_to COLLATE "C" >= delivery_from COLLATE "C"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_delivery_estimate_deleted_at" ON "delivery_estimate" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "holiday" ("id" text not null, "date" text not null, "name" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "holiday_pkey" primary key ("id"), constraint holiday_date_format check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}\$'), constraint holiday_name_not_blank check (name ~ '[^[:space:]]'));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_holiday_date_unique" ON "holiday" ("date") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_holiday_deleted_at" ON "holiday" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "transit_time" ("id" text not null, "zone" text check ("zone" in ('lima_metro', 'callao', 'rest_of_peru')) not null, "min_days" integer not null, "max_days" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "transit_time_pkey" primary key ("id"), constraint transit_time_min_days_non_negative check (min_days >= 0), constraint transit_time_max_days_gte_min_days check (max_days >= min_days));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_transit_time_deleted_at" ON "transit_time" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "ubigeo_departamento" ("id" text not null, "code" text not null, "name" text not null, "iso_3166_2" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ubigeo_departamento_pkey" primary key ("id"), constraint ubigeo_departamento_code_format check (code ~ '^[0-9]{2}\$'), constraint ubigeo_departamento_name_not_blank check (name ~ '[^[:space:]]'), constraint ubigeo_departamento_iso_3166_2_format check (iso_3166_2 ~ '^pe-[a-z]{3}\$'));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ubigeo_departamento_code_unique" ON "ubigeo_departamento" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ubigeo_departamento_iso_3166_2_unique" ON "ubigeo_departamento" ("iso_3166_2") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ubigeo_departamento_deleted_at" ON "ubigeo_departamento" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "ubigeo_provincia" ("id" text not null, "departamento_id" text not null, "code" text not null, "name" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ubigeo_provincia_pkey" primary key ("id"), constraint ubigeo_provincia_code_format check (code ~ '^[0-9]{4}\$'), constraint ubigeo_provincia_name_not_blank check (name ~ '[^[:space:]]'));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ubigeo_provincia_departamento_id" ON "ubigeo_provincia" ("departamento_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ubigeo_provincia_code_unique" ON "ubigeo_provincia" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ubigeo_provincia_deleted_at" ON "ubigeo_provincia" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "ubigeo_distrito" ("id" text not null, "provincia_id" text not null, "code" text not null, "name" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ubigeo_distrito_pkey" primary key ("id"), constraint ubigeo_distrito_code_format check (code ~ '^[0-9]{6}\$'), constraint ubigeo_distrito_name_not_blank check (name ~ '[^[:space:]]'));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ubigeo_distrito_provincia_id" ON "ubigeo_distrito" ("provincia_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ubigeo_distrito_code_unique" ON "ubigeo_distrito" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ubigeo_distrito_deleted_at" ON "ubigeo_distrito" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "ubigeo_provincia" add constraint "ubigeo_provincia_departamento_id_foreign" foreign key ("departamento_id") references "ubigeo_departamento" ("id") on update cascade;`);

    this.addSql(`alter table if exists "ubigeo_distrito" add constraint "ubigeo_distrito_provincia_id_foreign" foreign key ("provincia_id") references "ubigeo_provincia" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "ubigeo_provincia" drop constraint if exists "ubigeo_provincia_departamento_id_foreign";`);

    this.addSql(`alter table if exists "ubigeo_distrito" drop constraint if exists "ubigeo_distrito_provincia_id_foreign";`);

    this.addSql(`drop table if exists "delivery_estimate" cascade;`);

    this.addSql(`drop table if exists "holiday" cascade;`);

    this.addSql(`drop table if exists "transit_time" cascade;`);

    this.addSql(`drop table if exists "ubigeo_departamento" cascade;`);

    this.addSql(`drop table if exists "ubigeo_provincia" cascade;`);

    this.addSql(`drop table if exists "ubigeo_distrito" cascade;`);
  }

}
