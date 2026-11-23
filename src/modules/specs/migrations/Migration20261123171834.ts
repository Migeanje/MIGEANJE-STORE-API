import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261123171834 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "spec_value" drop constraint if exists "spec_value_sheet_id_definition_id_unique";`);
    this.addSql(`alter table if exists "spec_definition" drop constraint if exists "spec_definition_schema_id_rank_unique";`);
    this.addSql(`alter table if exists "spec_definition" drop constraint if exists "spec_definition_schema_id_label_unique";`);
    this.addSql(`alter table if exists "spec_definition" drop constraint if exists "spec_definition_schema_id_key_unique";`);
    this.addSql(`create table if not exists "spec_schema" ("id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "spec_schema_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_spec_schema_deleted_at" ON "spec_schema" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "spec_definition" ("id" text not null, "schema_id" text not null, "key" text not null, "label" text not null, "unit" text null, "kind" text check ("kind" in ('number', 'text', 'boolean', 'list')) not null, "filterable" boolean not null default false, "comparable" boolean not null default true, "rank" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "spec_definition_pkey" primary key ("id"), constraint spec_definition_key_format check (key ~ '^[a-z][a-zA-Z0-9]*\$'), constraint spec_definition_label_not_blank check (btrim(label) <> ''), constraint spec_definition_unit_only_for_numbers check (unit IS NULL OR kind = 'number'), constraint spec_definition_rank_not_negative check (rank >= 0));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_spec_definition_schema_id" ON "spec_definition" ("schema_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_spec_definition_deleted_at" ON "spec_definition" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_spec_definition_schema_id_key_unique" ON "spec_definition" ("schema_id", "key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_spec_definition_schema_id_label_unique" ON "spec_definition" ("schema_id", "label") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_spec_definition_schema_id_rank_unique" ON "spec_definition" ("schema_id", "rank") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "product_spec_sheet" ("id" text not null, "schema_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_spec_sheet_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_spec_sheet_schema_id" ON "product_spec_sheet" ("schema_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_spec_sheet_deleted_at" ON "product_spec_sheet" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "spec_value" ("id" text not null, "sheet_id" text not null, "definition_id" text not null, "number_value" real null, "text_value" text null, "boolean_value" boolean null, "list_value" text[] null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "spec_value_pkey" primary key ("id"), constraint spec_value_exactly_one_column check (num_nonnulls(number_value, text_value, boolean_value, list_value) = 1));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_spec_value_sheet_id" ON "spec_value" ("sheet_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_spec_value_definition_id" ON "spec_value" ("definition_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_spec_value_deleted_at" ON "spec_value" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_spec_value_sheet_id_definition_id_unique" ON "spec_value" ("sheet_id", "definition_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "spec_definition" add constraint "spec_definition_schema_id_foreign" foreign key ("schema_id") references "spec_schema" ("id") on update cascade;`);

    this.addSql(`alter table if exists "product_spec_sheet" add constraint "product_spec_sheet_schema_id_foreign" foreign key ("schema_id") references "spec_schema" ("id") on update cascade;`);

    this.addSql(`alter table if exists "spec_value" add constraint "spec_value_sheet_id_foreign" foreign key ("sheet_id") references "product_spec_sheet" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table if exists "spec_value" add constraint "spec_value_definition_id_foreign" foreign key ("definition_id") references "spec_definition" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "spec_definition" drop constraint if exists "spec_definition_schema_id_foreign";`);

    this.addSql(`alter table if exists "product_spec_sheet" drop constraint if exists "product_spec_sheet_schema_id_foreign";`);

    this.addSql(`alter table if exists "spec_value" drop constraint if exists "spec_value_definition_id_foreign";`);

    this.addSql(`alter table if exists "spec_value" drop constraint if exists "spec_value_sheet_id_foreign";`);

    this.addSql(`drop table if exists "spec_schema" cascade;`);

    this.addSql(`drop table if exists "spec_definition" cascade;`);

    this.addSql(`drop table if exists "product_spec_sheet" cascade;`);

    this.addSql(`drop table if exists "spec_value" cascade;`);
  }

}
