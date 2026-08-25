import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { createHeldNativeProvider } from "./create_held_native_provider.ts"
import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import type { BoundedChildResult } from "./process_types.ts"
import type { BoundedChildRunner,
  InternalProviderSqlKind } from "./runtime_adapter_types.ts"

test("real resolver and owner compose through every production provider stage", async () => {
  const repositoryRoot = join(import.meta.dirname, "../..")
  const temporaryRoot = join(import.meta.dirname, "tmp-native-provider")
  mkdirSync(temporaryRoot, { recursive: true })
  const calls: string[][] = []
  const childResult = (stdout: string): BoundedChildResult => {
    const bytes = new TextEncoder().encode(stdout)
    return { outcome: { status: "success", exitCode: 0, signal: null,
      stdoutBytes: bytes.byteLength, stderrBytes: 0, limitedStream: null },
    stdout: bytes, stderr: new Uint8Array() }
  }
  const runner: BoundedChildRunner = async (request) => {
    assert.equal(request.executable, "/proc/self/fd/3")
    assert.equal(Object.isFrozen(request.heldExecutable), true)
    assert.deepEqual(Object.keys(request.heldExecutable!), [])
    calls.push([...request.arguments])
    return childResult(request.arguments[0] === "--version" ? "2.109.1\n" : "[]\n")
  }
  const provider = await createHeldNativeProvider(repositoryRoot, {
    PATH: "/fake/path", SUPABASE_ACCESS_TOKEN: "must-not-escape",
  }, runner)
  const kinds: InternalProviderSqlKind[] = [
    "cleanup", "deadman_reconciliation", "fast_sample", "guard_bootstrap",
    "guard_heartbeat_fast", "guard_heartbeat_resource", "resource_sample", "rollback",
  ]
  try {
    for (const kind of kinds) {
      const result = await executeProviderQuery({
        repositoryRoot, provider,
        sql: createInternalProviderSql(kind, "select 1;\n"),
        parser: () => kind,
      }, { temporaryRoot })
      assert.deepEqual(result, { status: "success", value: kind })
    }
  } finally { await provider.close() }
  assert.deepEqual(calls[0], ["--version"])
  assert.equal(calls.length, kinds.length + 1)
  for (const args of calls.slice(1)) {
    assert.deepEqual(args.slice(0, 4), ["db", "query", "--linked", "--file"])
    assert.deepEqual(args.slice(5), [
      "--workdir", repositoryRoot, "--output-format", "json",
    ])
    assert.equal(args.some((value) => ["node", "pnpm", "exec"].includes(value)), false)
  }
  for (const file of [
    "run_pre_guard_baselines.ts", "run_guard_bootstrap.ts", "execute_sampling_boundary.ts",
    "run_fresh_rollback.ts", "run_deadman_reconciliation.ts", "run_fresh_cleanup.ts",
    "run_final_inactive_readback.ts",
  ]) {
    const source = await readFile(join(import.meta.dirname, file), "utf8")
    assert.match(source, /provider: .*\.runtime\.provider/)
    assert.doesNotMatch(source, /providerCommand|pnpm|heldExecutable/)
  }
  const composition = await readFile(join(
    import.meta.dirname, "prepare_canary_runtime.ts",
  ), "utf8")
  assert.match(composition, /createProvider: createHeldNativeProvider/)
  assert.match(composition, /runChild: runBoundedChild/)
  const program = await readFile(join(
    import.meta.dirname, "create_canary_program_dependencies.ts",
  ), "utf8")
  assert.match(program, /prepareRuntime: prepareCanaryRuntime/)
})
