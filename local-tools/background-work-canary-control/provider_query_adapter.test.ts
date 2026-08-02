import assert from "node:assert/strict"
import { lstat, mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { createFakeHeldProvider } from "./create_fake_held_provider.test_fixture.ts"
import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { generateRollbackSql } from "./generate_rollback_sql.ts"
import { CHILD_OUTPUT_LIMIT_BYTES } from "./process_constants.ts"
import { VALID_RECOVERY_CONTROL_INPUT } from "./recovery_control.test_fixture.ts"
import type { BoundedChildResult } from "./process_types.ts"
function childResult(status: BoundedChildResult["outcome"]["status"],
  stdout = "[]\n", stderr = ""): BoundedChildResult {
  const out = new TextEncoder().encode(stdout)
  const err = new TextEncoder().encode(stderr)
  return { outcome: { status, exitCode: status === "success" ? 0 : 7,
    signal: null, stdoutBytes: out.byteLength, stderrBytes: err.byteLength,
    limitedStream: status === "output_limit" ? "stdout" : null },
  stdout: out, stderr: err }
}

test("provider adapter uses exact argv, private temp files, and sanitized environment", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-provider-root-"))
  const temporaryRoot = await mkdtemp(join(tmpdir(), "momi-provider-temp-"))
  const sql = createInternalProviderSql("rollback", generateRollbackSql(
    VALID_RECOVERY_CONTROL_INPUT,
  ))
  try {
    const provider = createFakeHeldProvider({ runQuery: async (request) => {
      assert.equal(request.repositoryRoot, root)
      const sqlPath = request.sqlPath
      assert.equal((await lstat(dirname(sqlPath))).mode & 0o777, 0o700)
      assert.equal((await lstat(sqlPath)).mode & 0o777, 0o600)
      assert.equal(await readFile(sqlPath, "utf8"), sql.sql)
      return childResult("success", "[{\"safe\":true}]\n")
    } })
    const result = await executeProviderQuery({
      repositoryRoot: root, provider, sql,
      parser: (stdout) => new TextDecoder().decode(stdout),
    }, { temporaryRoot })
    assert.deepEqual(result, { status: "success", value: "[{\"safe\":true}]\n" })
    assert.deepEqual(await readdir(temporaryRoot), [])
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

test("provider adapter maps all child and schema failures and always cleans temp SQL", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-provider-fail-root-"))
  const temporaryRoot = await mkdtemp(join(tmpdir(), "momi-provider-fail-temp-"))
  const sql = createInternalProviderSql("rollback", generateRollbackSql(
    VALID_RECOVERY_CONTROL_INPUT,
  ))
  try {
    for (const status of [
      "timed_out", "cancelled", "exit_failure", "signalled", "output_limit",
    ] as const) {
      const stdout = status === "output_limit" ? "x".repeat(CHILD_OUTPUT_LIMIT_BYTES) : ""
      const provider = createFakeHeldProvider({ runQuery: async () =>
        childResult(status, stdout, "private-credential-value") })
      const result = await executeProviderQuery({
        repositoryRoot: root, provider, sql,
        parser: () => "never",
      }, { temporaryRoot })
      assert.deepEqual(result, { status: "failure", reason: status })
      assert.equal(JSON.stringify(result).includes("private-credential-value"), false)
      assert.equal(JSON.stringify(result).includes(sql.sql), false)
      assert.deepEqual(await readdir(temporaryRoot), [])
    }
    const provider = createFakeHeldProvider({ runQuery: async () => childResult("success") })
    const schema = await executeProviderQuery({
      repositoryRoot: root, provider, sql,
      parser: () => { throw new Error("raw-schema-output") },
    }, { temporaryRoot })
    assert.deepEqual(schema, { status: "failure", reason: "schema_failure" })
    assert.deepEqual(await readdir(temporaryRoot), [])
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

test("provider adapter rejects unregistered SQL before spawning a child", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-provider-forged-root-"))
  const temporaryRoot = await mkdtemp(join(tmpdir(), "momi-provider-forged-temp-"))
  let called = false
  try {
    const provider = createFakeHeldProvider({ runQuery: async () => {
      called = true
      return childResult("success")
    } })
    const result = await executeProviderQuery({
      repositoryRoot: root, provider,
      sql: { kind: "rollback", sql: "select 'secret';\n", sha256: "0".repeat(64) },
      parser: () => "never",
    }, { temporaryRoot })
    assert.deepEqual(result, { status: "failure", reason: "adapter_failure" })
    assert.equal(called, false)
    assert.deepEqual(await readdir(temporaryRoot), [])
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})
