import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { workspaceRoot } from "../scripts/architecture/paths.ts";
import { loadLocalMigrations } from "../scripts/migrations/load_local_migrations.ts";
import {
  replayRelationInventory,
} from "../scripts/constitution/replay_relation_inventory.ts";

test("replays the exact current application relation inventory", async () => {
  const migrations = await loadLocalMigrations(join(
    workspaceRoot,
    "supabase",
    "migrations",
  ));
  const inventory = replayRelationInventory(migrations);
  const kinds = [...inventory.values()];
  assert.equal(inventory.size, 174);
  assert.equal(kinds.filter((kind) => kind === "table").length, 143);
  assert.equal(kinds.filter((kind) => kind === "view").length, 31);
  for (
    const relation of [
      "momi_preorder.catalog_items",
      "momi_preorder.checkout_holds",
      "momi_preorder.commands",
      "momi_preorder.configuration_publications",
      "momi_preorder.configuration_item_policies",
      "momi_preorder.configuration_pickup_schedule_days",
      "momi_preorder.configuration_price_classes",
      "momi_preorder.fulfillment_windows",
      "momi_preorder.orders",
      "momi_preorder.payment_attempts",
      "momi_preorder.payment_evidence",
      "momi_preorder.public_read_rate_buckets",
      "momi_preorder.public_request_rate_buckets",
      "momi_preorder.quotes",
      "momi_preorder.surfaces",
      "momi_cron_history.batch_candidates",
      "momi_cron_history.batch_receipts",
      "momi_cron_history.batch_summary_coverage",
      "momi_cron_history.exception_declarations",
      "momi_cron_history.exception_ledger",
      "momi_cron_history.governor_ticks",
      "momi_cron_history.health_samples",
      "momi_cron_history.incident_holds",
      "momi_cron_history.incomplete_gaps",
      "momi_cron_history.job_terminal_state",
      "momi_cron_history.minute_summaries",
      "momi_cron_history.policy_control",
      "momi_cron_history.scan_state",
      "momi_agent_ops.dispatches",
      "momi_agent_ops.project_mappings",
      "momi_agent_ops.raw_webhook_envelopes",
      "momi_agent_ops.run_records",
      "momi_governance.bootstrap_reconciliations",
      "momi_governance.decision_evidence",
      "momi_governance.decision_events",
      "momi_governance.decision_external_references",
      "momi_governance.material_decisions",
      "trello_acquisition.webhook_inventory_jobs",
    ]
  ) assert.equal(inventory.get(relation), "table");
});

test("applies schema moves, relation renames, and drops in statement order", () => {
  const migrations = new Map([
    ["001.sql", "create table old_schema.items (id int);"],
    ["002.sql", "alter schema old_schema rename to next_schema;"],
    [
      "003.sql",
      `alter table next_schema.items rename to records;
      alter table next_schema.records set schema final_schema;`,
    ],
    [
      "004.sql",
      `drop table final_schema.records;
      create view next_schema.records as select 1;`,
    ],
    [
      "005.sql",
      `alter view next_schema.records rename to current_records;
      alter view next_schema.current_records set schema final_schema;`,
    ],
  ]);
  assert.deepEqual(
    [...replayRelationInventory(migrations)],
    [["final_schema.current_records", "view"]],
  );
});

test("tracks every schema and applies multi-object and schema drops", () => {
  const migrations = new Map([
    [
      "001.sql",
      `create unlogged table public.first (id int);
      create table unlisted.second (id int);
      create view unlisted.third as select 1;`,
    ],
    ["002.sql", "drop table public.first, unlisted.second;"],
    ["003.sql", "drop schema unlisted cascade;"],
  ]);
  assert.deepEqual([...replayRelationInventory(migrations)], []);
});

test("fails closed on unsupported persistent relation DDL", () => {
  for (
    const sql of [
      "create table unqualified (id int);",
      "create view unqualified as select 1;",
      "create foreign table public.remote (id int) server external_source;",
    ]
  ) {
    assert.throws(
      () => replayRelationInventory(new Map([["001.sql", sql]])),
      /unsupported persistent relation DDL|unsupported relation drop target/,
    );
  }
});
