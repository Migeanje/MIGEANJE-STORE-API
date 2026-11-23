import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261123171842 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "rubric_score" drop constraint if exists "rubric_score_review_id_criterion_id_unique";`);
    this.addSql(`alter table if exists "rubric_criterion" drop constraint if exists "rubric_criterion_rubric_id_rank_unique";`);
    this.addSql(`alter table if exists "rubric_criterion" drop constraint if exists "rubric_criterion_rubric_id_name_unique";`);
    this.addSql(`create table if not exists "review_rubric" ("id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "review_rubric_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_rubric_deleted_at" ON "review_rubric" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "expert_review" ("id" text not null, "verdict" text not null, "for_whom" text[] not null, "not_for" text[] not null, "rubric_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "expert_review_pkey" primary key ("id"), constraint expert_review_check check (length(btrim(verdict)) > 0 AND char_length(verdict) <= 240));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_expert_review_rubric_id" ON "expert_review" ("rubric_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_expert_review_deleted_at" ON "expert_review" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "rubric_criterion" ("id" text not null, "name" text not null, "rank" integer not null, "rubric_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rubric_criterion_pkey" primary key ("id"), constraint rubric_criterion_check check (rank >= 0));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rubric_criterion_rubric_id" ON "rubric_criterion" ("rubric_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rubric_criterion_deleted_at" ON "rubric_criterion" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_rubric_criterion_rubric_id_name_unique" ON "rubric_criterion" ("rubric_id", "name") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_rubric_criterion_rubric_id_rank_unique" ON "rubric_criterion" ("rubric_id", "rank") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "rubric_score" ("id" text not null, "score" integer not null, "note" text not null, "review_id" text not null, "criterion_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rubric_score_pkey" primary key ("id"), constraint rubric_score_score_range_check check (score BETWEEN 1 AND 5), constraint rubric_score_note_not_blank_check check (length(btrim(note)) > 0));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rubric_score_review_id" ON "rubric_score" ("review_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rubric_score_criterion_id" ON "rubric_score" ("criterion_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rubric_score_deleted_at" ON "rubric_score" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_rubric_score_review_id_criterion_id_unique" ON "rubric_score" ("review_id", "criterion_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "expert_review" add constraint "expert_review_rubric_id_foreign" foreign key ("rubric_id") references "review_rubric" ("id") on update cascade;`);

    this.addSql(`alter table if exists "rubric_criterion" add constraint "rubric_criterion_rubric_id_foreign" foreign key ("rubric_id") references "review_rubric" ("id") on update cascade;`);

    this.addSql(`alter table if exists "rubric_score" add constraint "rubric_score_review_id_foreign" foreign key ("review_id") references "expert_review" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table if exists "rubric_score" add constraint "rubric_score_criterion_id_foreign" foreign key ("criterion_id") references "rubric_criterion" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "expert_review" drop constraint if exists "expert_review_rubric_id_foreign";`);

    this.addSql(`alter table if exists "rubric_criterion" drop constraint if exists "rubric_criterion_rubric_id_foreign";`);

    this.addSql(`alter table if exists "rubric_score" drop constraint if exists "rubric_score_review_id_foreign";`);

    this.addSql(`alter table if exists "rubric_score" drop constraint if exists "rubric_score_criterion_id_foreign";`);

    this.addSql(`drop table if exists "review_rubric" cascade;`);

    this.addSql(`drop table if exists "expert_review" cascade;`);

    this.addSql(`drop table if exists "rubric_criterion" cascade;`);

    this.addSql(`drop table if exists "rubric_score" cascade;`);
  }

}
