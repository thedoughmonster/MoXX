import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = new URL(
  "../../../supabase/migrations/" +
    "20260718115740_disambiguate_communications_evaluation_completion.sql",
  import.meta.url,
)

test("disambiguates evaluator completion conflict targets", async () => {
  const sql = await readFile(migration, "utf8")
  assert.match(sql,
    /create or replace function momi_communications\.complete_evaluation_job_v1/)
  assert.match(sql, /#variable_conflict use_column/)
  assert.match(sql,
    /on conflict \(evaluation_job_id\) where evaluation_job_id is not null/)
  assert.match(sql,
    /on conflict \(evaluation_id, derived_key\) where evaluation_id is not null/)
  assert.match(sql, /security invoker/)
  assert.match(sql, /set search_path = ''/)
  assert.doesNotMatch(sql, /cron\.|function_trigger_registry|function_registry/)
})
