import postgres from "postgres";

import type {
  LedgerConcurrencyEvent,
  LedgerConcurrencyResult,
} from "./project_baseline_ledger_concurrency_types.ts";

export async function appendConcurrencyEvent(
  sql: postgres.Sql,
  input: LedgerConcurrencyEvent,
): Promise<LedgerConcurrencyResult> {
  const source = {
    schema_version: 1,
    encoding: "utf-8",
    content: input.decision,
  };
  const event = {
    schema_version: 1,
    encoding: "utf-8",
    content: input.event,
  };
  const rows = await sql<LedgerConcurrencyResult[]>`
    select * from momi_governance.append_decision_event_v1(
      'concurrency_fixture', ${input.decision},
      momi_governance.provenance_digest_v1(${sql.json(source)}::jsonb),
      ${sql.json(source)}::jsonb, 'governance', ${input.status},
      'concurrency_fixture', ${input.event},
      momi_governance.provenance_digest_v1(${sql.json(event)}::jsonb),
      ${sql.json(event)}::jsonb, ${`idempotency:${input.event}`},
      ${`Concurrency fixture ${input.decision}`},
      'Prove related-decision serialization', '[]'::jsonb, '[]'::jsonb,
      'local-validator', '2026-08-17T01:00:00Z'::timestamptz,
      'disposable PostgreSQL concurrency receipt',
      ${input.relatedDecisionId ?? null}::uuid, '[]'::jsonb, '[]'::jsonb
    )
  `;
  return rows[0];
}
