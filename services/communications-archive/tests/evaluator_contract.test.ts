import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../../../supabase/migrations/", import.meta.url)

test("claims, completes, and retries evaluator work through structured RPCs", async () => {
  const sql = await readFile(new URL(
    "20260717083717_add_communications_evaluator_lifecycle.sql", migrations,
  ), "utf8")
  assert.match(sql, /add column next_attempt_at timestamptz/)
  assert.match(sql, /add column lease_expires_at timestamptz/)
  assert.match(sql, /'dead_letter'/)
  assert.match(sql, /create function momi_communications\.claim_evaluation_job_v1/)
  assert.match(sql, /lease_expires_at = now\(\) \+ interval '5 minutes'/)
  assert.match(sql, /create unique index communication_evaluations_job_unique/)
  assert.match(sql, /create function momi_communications\.complete_evaluation_job_v1/)
  assert.match(sql, /insert into momi_communications\.communication_evaluations/)
  assert.match(sql, /insert into momi_communications\.derived_records/)
  assert.match(sql, /insert into momi_communications\.audit_events/)
  assert.match(sql, /create function momi_communications\.fail_evaluation_job_v1/)
  assert.match(sql, /security invoker/g)
  assert.match(sql, /grant execute on function momi_communications\.claim_evaluation_job_v1/)
})

test("registers exact dormant evaluator work", async () => {
  const sql = await readFile(new URL(
    "20260717083725_register_communications_evaluator.sql", migrations,
  ), "utf8")
  const manifest = await readFile(new URL(
    "../functions/momi-communications-evaluate-item-v1/function.json",
    import.meta.url,
  ), "utf8")
  const manifestHash = createHash("sha256").update(manifest).digest("hex")
  assert.match(sql, /'momi\.communications\.evaluate_item\.v1'/)
  assert.match(sql,
    /'evaluation_job_id',\s*'evaluation_job_id', 'body', true, 'bigint'/)
  assert.match(sql,
    /'capability_token',\s*'capability_token', 'body', true, 'uuid'/)
  assert.match(sql, /'durable\.work_token\.v1', false, 'communications-archive'/)
  assert.equal(sql.includes(manifestHash), true)
})

test("empty scheduled checks cannot invoke the evaluator", async () => {
  const sql = await readFile(new URL(
    "20260717083729_add_communications_evaluator_trigger_adapter.sql", migrations,
  ), "utf8")
  assert.match(sql, /'30 seconds'/)
  assert.match(sql, /limit 4 for update skip locked/)
  assert.match(sql, /after update of capability_token/)
  assert.match(sql, /'evaluation_job_id', new\.evaluation_job_id::text/)
  assert.match(sql, /'capability_token', new\.capability_token::text/)
  assert.match(sql, /cron\.alter_job\(job_id := jobid, active := false\)/)
  assert.doesNotMatch(sql, /raw_text|payload|source_metadata/)
})

test("exposes only redacted service-role evaluator operations", async () => {
  const sql = await readFile(new URL(
    "20260717110022_add_communications_evaluator_operator_rpcs.sql", migrations,
  ), "utf8")
  assert.match(sql,
    /create function momi_communications\.dispatch_evaluation_job_v1/)
  assert.match(sql, /returns table \(disposition text, evaluation_job_id bigint\)/)
  assert.match(sql,
    /create function momi_communications\.get_evaluation_job_status_v1/)
  assert.match(sql,
    /create function momi_communications\.get_evaluation_queue_status_v1/)
  assert.match(sql, /grant execute[\s\S]*to service_role/g)
  assert.doesNotMatch(sql, /grant execute[\s\S]*to (anon|authenticated)/)
  const statusSql = sql.slice(sql.indexOf("create function momi_communications.get_evaluation_job_status_v1"))
  assert.doesNotMatch(statusSql, /raw_text|payload|source_metadata/)
})

test("activates only the evaluator canary route", async () => {
  const sql = await readFile(new URL(
    "20260717115647_activate_communications_evaluator_canary_route.sql", migrations,
  ), "utf8")
  assert.match(sql, /update momi_runtime\.function_registry/)
  assert.match(sql, /update momi_runtime\.function_trigger_registry/)
  assert.match(sql, /'momi\.communications\.evaluate_item\.http\.v1'/)
  assert.match(sql, /cron\.alter_job\(job_id := jobid, active := false\)/)
  assert.match(sql, /not active and schedule = '30 seconds'/)
  assert.doesNotMatch(sql,
    /cron\.alter_job\(job_id := jobid, active := true\)/)
})

test("disables the evaluator after a failed canary", async () => {
  const sql = await readFile(new URL(
    "20260717121345_disable_communications_evaluator_after_canary_failure.sql",
    migrations,
  ), "utf8")
  assert.match(sql, /update momi_runtime\.function_trigger_registry/)
  assert.match(sql, /update momi_runtime\.function_registry/)
  assert.match(sql, /set active = false/g)
  assert.match(sql, /cron\.alter_job\(job_id := jobid, active := false\)/)
  assert.match(sql, /not active and schedule = '30 seconds'/)
  assert.doesNotMatch(sql,
    /momi_communications\.(archive_items|evaluation_jobs)/)
})

test("limits evaluator network authority to the OpenAI Responses API", async () => {
  const service = JSON.parse(await readFile(new URL("../service.json", import.meta.url),
    "utf8")) as Record<string, Record<string, string[]>>
  const source = await readFile(new URL(
    "../functions/momi-communications-evaluate-item-v1/src/call_openai_evaluation.ts",
    import.meta.url,
  ), "utf8")
  assert.deepEqual(service.network.outbound_hosts, ["api.openai.com"])
  assert.match(source, /fetchImpl\("https:\/\/api\.openai\.com\/v1\/responses"/)
  assert.doesNotMatch(source, /clickup|github\.com|slack\.com/i)
})
