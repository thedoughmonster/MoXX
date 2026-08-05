import assert from "node:assert/strict"
import { test } from "node:test"
import { parsePublicInvocation } from "./parse_public_invocation.ts"

test("public runtime surface accepts only exact development scope", () => {
  assert.deepEqual(parsePublicInvocation([
    "--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn",
  ]), { environment: "dev", projectRef: "xtbraqnlskmqxinjxxdn" })
  for (const option of [
    "--mode", "--sql", "--timing", "--threshold", "--path", "--credential",
    "--run-id", "--target", "--environment", "--database-url", "--url",
    "--query", "--activation", "--rollback", "--receipt", "--receipt-root",
    "--release-sha", "--supabase-executable", "--provider-path",
  ]) assert.throws(() => parsePublicInvocation([
    "--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn", option, "value",
  ]))
})
