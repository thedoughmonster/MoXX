import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("types dynamic values persisted inside JSON outcomes", async () => {
  const directory = new URL("../", import.meta.url)
  const [successSql, failureSql] = await Promise.all([
    readFile(new URL("record_success.ts", directory), "utf8"),
    readFile(new URL("record_failure.ts", directory), "utf8"),
  ])

  for (const source of [successSql, failureSql]) {
    assert.match(source, /\$\{work\.attempt_id\}::text/)
    assert.match(source, /\$\{work\.invocation_id\}::text/)
    assert.match(source, /http_status', \$\{[^}]+\}::integer/)
  }

  assert.match(successSql, /slack_channel_id', \$\{summary\.channel\}::text/)
  assert.match(successSql, /slack_message_ts', \$\{summary\.ts\}::text/)
  assert.match(failureSql, /error_code', \$\{failure\.error_code\}::text/)
})

test("uses only source-neutral durable state namespaces", async () => {
  const directory = new URL("../", import.meta.url)
  const files = [
    "claim_work.ts",
    "load_prepared_message.ts",
    "read_work_state.ts",
    "record_failure.ts",
    "record_success.ts",
  ]
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(file, directory), "utf8")),
  )
  const combined = sources.join("\n")

  assert.doesNotMatch(combined, /toast_alerting|toast_hydration/)
  assert.match(combined, /momi_alerting\.slack_delivery_work/)
  assert.match(combined, /momi_runtime\.function_registry/)
})

test("declares the source-neutral Slack delivery contract", async () => {
  const directory = new URL("../", import.meta.url)
  const [manifestText, inputText, outputText, typesSource] = await Promise.all([
    readFile(new URL("function.json", directory), "utf8"),
    readFile(new URL("contracts/input.schema.json", directory), "utf8"),
    readFile(new URL("contracts/output.schema.json", directory), "utf8"),
    readFile(new URL("types.ts", directory), "utf8"),
  ])
  const manifest = JSON.parse(manifestText)
  const inputSchema = JSON.parse(inputText)
  const outputSchema = JSON.parse(outputText)

  assert.equal(manifest.function_key, "momi.slack.order_alert.deliver.v1")
  assert.equal(manifest.idempotency_policy_key, "momi.alert.candidate.v1")
  assert.equal(manifest.route_path, "/functions/v1/slack-order-alert-delivery-v1")
  assert.equal(manifest.owner_service, "momi-slack-alert-delivery")
  assert.equal(inputSchema.$id, "momi://momi.slack.order_alert.deliver.v1/input")
  assert.equal(outputSchema.$id, "momi://momi.slack.order_alert.deliver.v1/output")
  assert.match(typesSource, /momi\.slack\.order_alert\.deliver\.v1/)
})
