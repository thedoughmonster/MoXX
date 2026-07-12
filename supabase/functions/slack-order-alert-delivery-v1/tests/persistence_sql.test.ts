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
