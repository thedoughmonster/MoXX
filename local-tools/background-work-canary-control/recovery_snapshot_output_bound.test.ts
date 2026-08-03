import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { createFakeHeldProvider } from "./create_fake_held_provider.test_fixture.ts"
import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { encodeQueryEnvelope } from "./encode_query_envelope.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { createRecoverySnapshotFixture } from "./create_recovery_snapshot.test_fixture.ts"
import { generateRecoveryBoundaryConfigSql } from "./generate_recovery_boundary_config_sql.ts"
import { generateRecoveryPreflightSql } from "./generate_recovery_preflight_sql.ts"
import { parseCliQueryEnvelope } from "./parse_cli_query_envelope.ts"
import { RECOVERY_PREFLIGHT_MARKER,
  RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES } from "./recovery_constants.ts"

test("recovery-only proof output has a bounded larger parser and provider allowance", async () => {
  const value = "a".repeat(70 * 1024)
  const output = encodeQueryEnvelope(RECOVERY_PREFLIGHT_MARKER, value)
  assert.throws(() => parseCliQueryEnvelope(output, RECOVERY_PREFLIGHT_MARKER))
  assert.equal(parseCliQueryEnvelope(output, RECOVERY_PREFLIGHT_MARKER,
    RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES), value)
  const root = await mkdtemp(join(tmpdir(), "momi-proof-root-"))
  const temporaryRoot = await mkdtemp(join(tmpdir(), "momi-proof-temp-"))
  try {
    const sql = createInternalProviderSql("recovery_preflight",
      generateRecoveryPreflightSql())
    const provider = createFakeHeldProvider({ runQuery: async (request) => {
      assert.equal(request.outputLimitBytes, RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES)
      return { outcome: { status: "success", exitCode: 0, signal: null,
        stdoutBytes: output.byteLength, stderrBytes: 0, limitedStream: null },
      stdout: output, stderr: new Uint8Array() }
    } })
    const result = await executeProviderQuery({ repositoryRoot: root, provider, sql,
      outputLimitBytes: RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES,
      parser: (bytes) => parseCliQueryEnvelope(bytes, RECOVERY_PREFLIGHT_MARKER,
        RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES) }, { temporaryRoot })
    assert.deepEqual(result, { status: "success", value })
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

test("large prior-member proofs remain recovery-only bounded SQL", () => {
  const proof = Array.from({ length: 2_000 }, (_, index) =>
    index.toString(16).padStart(64, "0"))
  const sql = `${generateRecoveryBoundaryConfigSql(createRecoverySnapshotFixture({
    cohortMembershipProof: proof,
  }))}\n`
  assert.ok(Buffer.byteLength(sql) > 128 * 1024)
  assert.equal(createInternalProviderSql("recovery_observation", sql).sql, sql)
  assert.throws(() => createInternalProviderSql("rollback", sql))
})
