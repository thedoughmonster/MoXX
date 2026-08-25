import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { test } from "node:test"
import { createHeldNativeProvider } from "./create_held_native_provider.ts"
import { createFakeHeldProvider } from "./create_fake_held_provider.test_fixture.ts"
import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { DEV_PROJECT_REF } from "./constants.ts"
import { encodeQueryEnvelope } from "./encode_query_envelope.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { generateGuardBootstrapSql } from "./generate_guard_bootstrap_sql.ts"
import {
  VALID_GUARD_BOOTSTRAP_INPUT,
  VALID_GUARD_BOOTSTRAP_RESULT,
} from "./guard_bootstrap.test_fixture.ts"
import { GUARD_BOOTSTRAP_MARKER } from "./guard_bootstrap_constants.ts"
import { parseGuardBootstrapOutput } from "./parse_guard_bootstrap_output.ts"
import type { BoundedChildResult } from "./process_types.ts"
import type { BoundedChildRunner } from "./runtime_adapter_types.ts"
import { runRecoveryBootstrap } from "./run_recovery_bootstrap.ts"

test("held native provider composes multi-statement bootstrap through CLI JSON decoding", async () => {
  const repositoryRoot = join(import.meta.dirname, "../..")
  let queryCalls = 0
  const childResult = (stdout: Uint8Array): BoundedChildResult => ({
    outcome: { status: "success", exitCode: 0, signal: null,
      stdoutBytes: stdout.byteLength, stderrBytes: 0, limitedStream: null },
    stdout, stderr: new Uint8Array(),
  })
  const runner: BoundedChildRunner = async (request) => {
    if (request.arguments[0] === "--version") {
      return childResult(new TextEncoder().encode("2.109.1\n"))
    }
    queryCalls += 1
    assert.deepEqual(request.arguments.slice(0, 4), [
      "db", "query", "--linked", "--file",
    ])
    const sql = await readFile(request.arguments[4], "utf8")
    assert.match(sql, /^begin;[\s\S]*select[\s\S]*commit;\n$/)
    assert.match(sql, /expiry_at constant timestamptz := timestamptz/)
    return childResult(encodeQueryEnvelope(
      GUARD_BOOTSTRAP_MARKER, VALID_GUARD_BOOTSTRAP_RESULT,
    ))
  }
  const provider = await createHeldNativeProvider(repositoryRoot, {}, runner)
  try {
    const sql = createInternalProviderSql(
      "guard_bootstrap", generateGuardBootstrapSql(VALID_GUARD_BOOTSTRAP_INPUT),
    )
    const result = await executeProviderQuery({
      repositoryRoot, provider, sql,
      parser: (stdout) => parseGuardBootstrapOutput(stdout, {
        runId: VALID_GUARD_BOOTSTRAP_INPUT.runId,
        generationSha256: VALID_GUARD_BOOTSTRAP_INPUT.generationSha256,
        startCronRunId: VALID_GUARD_BOOTSTRAP_INPUT.startCronRunId,
      }),
    }, { temporaryRoot: "/tmp" })
    assert.deepEqual(result, { status: "success", value: VALID_GUARD_BOOTSTRAP_RESULT })
    assert.equal(queryCalls, 1)
  } finally {
    await provider.close()
  }
})

test("recovery state retains the guard-owned Cron baseline after bootstrap", async () => {
  const repositoryRoot = join(import.meta.dirname, "../..")
  const stdout = encodeQueryEnvelope(GUARD_BOOTSTRAP_MARKER,
    VALID_GUARD_BOOTSTRAP_RESULT)
  const provider = createFakeHeldProvider({ runQuery: async () => ({
    outcome: { status: "success", exitCode: 0, signal: null,
      stdoutBytes: stdout.byteLength, stderrBytes: 0, limitedStream: null },
    stdout, stderr: new Uint8Array(),
  }) })
  const state = { repositoryRoot, signal: new AbortController().signal,
    runtime: { provider, options: { projectRef: DEV_PROJECT_REF } },
    runId: VALID_GUARD_BOOTSTRAP_INPUT.runId,
    generationSha256: VALID_GUARD_BOOTSTRAP_INPUT.generationSha256 } as never
  await runRecoveryBootstrap(state, VALID_GUARD_BOOTSTRAP_INPUT.startCronRunId)
  assert.deepEqual(state.guard, VALID_GUARD_BOOTSTRAP_RESULT)
  assert.equal(state.guardStartCronRunId, VALID_GUARD_BOOTSTRAP_INPUT.startCronRunId)
  assert.equal(provider.status(), "held")
})
