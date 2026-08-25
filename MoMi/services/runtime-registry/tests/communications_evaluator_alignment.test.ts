import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../../../supabase/migrations/", import.meta.url)

test("aligns evaluator registry ownership without changing behavior", async () => {
  const sql = await readFile(new URL(
    "20260719180809_align_communications_evaluator_runtime_owner.sql",
    migrations,
  ), "utf8")
  const historical = await readFile(new URL(
    "20260717083725_register_communications_evaluator.sql",
    migrations,
  ))
  const manifest = await readFile(new URL(
    "../../communications-evaluation/functions/" +
      "momi-communications-evaluate-item-v1/function.json",
    import.meta.url,
  ))
  const manifestDigest = createHash("sha256").update(manifest).digest("hex")
  const registeredManifestDigest =
    "dda1dd7becf240cdb55ddcb242afb72148f9be8e785f1b5b8bc0e6005066e65c"

  assert.match(sql, /^-- service-owner: runtime-registry\n/)
  assert.equal(manifestDigest,
    "1523e4e5b7865a095c954493d17ce512918866dcd3235a4c73aef169d778e427")
  assert.match(sql, new RegExp(registeredManifestDigest, "g"))
  assert.doesNotMatch(sql, new RegExp(manifestDigest, "g"))
  assert.equal(
    createHash("sha256").update(historical).digest("hex"),
    "eea2b2b5ba0f7bdb6df51fb830818f19e37d0f48b5abdcce94a9826396813f1e",
  )

  for (const field of [
    "function_key = 'momi.communications.evaluate_item.v1'",
    "contract_version = 1",
    "function_type = 'coordinator'",
    "trigger_key = 'momi.communications.evaluate_item.http.v1'",
    "trigger_type = 'http'",
    "http_method = 'POST'",
    "route_path = '/functions/v1/momi-communications-evaluate-item-v1'",
    "schedule_policy_key = 'momi.communications.evaluator.schedule.v1'",
    "authentication_policy_key = 'durable.work_token.v1'",
  ]) {
    assert.ok(sql.includes(field), `missing stable field: ${field}`)
  }

  assert.equal((sql.match(/owner_service = 'communications-archive'/g) ?? []).length, 6)
  assert.equal((sql.match(/owner_service = 'communications-evaluation'/g) ?? []).length, 4)
  assert.match(sql, /select active into strict function_was_active/)
  assert.match(sql, /select active into strict trigger_was_active/)
  assert.match(sql, /active is not distinct from function_was_active/)
  assert.match(sql, /active is not distinct from trigger_was_active/)
  assert.equal((sql.match(/get diagnostics affected = row_count/g) ?? []).length, 2)
  assert.equal((sql.match(/if affected <> 1 then/g) ?? []).length, 2)
  assert.equal((sql.match(/\) <> 1 then/g) ?? []).length, 4)

  const updatedRelations: string[] = []
  for (const match of sql.matchAll(/update\s+(momi_runtime\.[a-z_]+)/g)) {
    updatedRelations.push(match[1])
  }
  assert.deepEqual(updatedRelations, [
    "momi_runtime.function_registry",
    "momi_runtime.function_trigger_registry",
  ])

  assert.doesNotMatch(sql, /set\s+active\b/i)
  assert.doesNotMatch(sql, /set\s+schedule\b|alter_job|cron\.|pg_net/i)
  assert.doesNotMatch(sql, /momi_communications\.|archive_items|evaluation_jobs|backlog/i)
  assert.doesNotMatch(sql, /\b(?:grant|revoke|insert|delete|create role|alter role)\b/i)
})

test("keeps schedule, backlog, and a second paid canary outside this change", async () => {
  const operations = await readFile(new URL(
    "../../../docs/communications-evaluation-operations.md",
    import.meta.url,
  ), "utf8")
  assert.match(operations, /Keep `momi-communications-evaluator-wakeup-v1` inactive/u)
  assert.match(operations, /Dispatch only one explicitly selected, due evaluation job at a time/u)
  assert.match(operations, /Stop again; do not drain another job implicitly/u)
  assert.match(operations,
    /Dead-letter release, backlog processing, automatic scheduling, production use,[\s\S]*require separate accepted procedures\s+and authority/u)
  assert.doesNotMatch(operations, /cron\.schedule|alter_job|drain backlog|second paid/u)
})
