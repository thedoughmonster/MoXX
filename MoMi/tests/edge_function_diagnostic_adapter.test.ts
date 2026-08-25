import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import type { LoadedFunction } from "../scripts/architecture/types.ts"
import { edgeFunctionCheckDiagnostic } from
  "../scripts/diagnostics/edge_function_check_diagnostic.ts"
import { isEdgeFunctionCheckDiagnosticApplicable } from
  "../scripts/diagnostics/is_edge_function_check_diagnostic_applicable.ts"
import { renderRepositoryDiagnostics } from
  "../scripts/diagnostics/render_repository_diagnostics.ts"
import { assertRepositoryDiagnostics } from
  "./assert_repository_diagnostics.ts"

const fixture = JSON.parse(await readFile(
  "tests/fixtures/repository_check_diagnostics.fixture.json", "utf8",
)) as { edge: Record<string, string> }
const loaded = {
  adapter_directory: join(workspaceRoot, fixture.edge.adapter_directory),
  source_directory: join(workspaceRoot, fixture.edge.source_directory),
  manifest: {
    function_key: fixture.edge.function_key,
    owner_service: fixture.edge.owner_service,
  },
} as LoadedFunction

test("identifies the authoritative Edge Function boundary without a fake fix", () => {
  const diagnostics = [
    edgeFunctionCheckDiagnostic(loaded, "type"),
    edgeFunctionCheckDiagnostic(loaded, "lint"),
  ]
  assertRepositoryDiagnostics(diagnostics)
  const output = renderRepositoryDiagnostics(diagnostics)
  assert.match(output, /EDGE_FUNCTION_TYPE_CHECK/u)
  assert.match(output, /EDGE_FUNCTION_LINT/u)
  assert.match(output, /fixture\.edge\.v1 is owned by fixture-owner/u)
  assert.match(output, /supabase\/functions\/fixture-edge-v1\/deno\.json/u)
  assert.match(output, /services\/fixture-owner\/functions\/fixture-edge-v1/u)
  assert.equal(output.match(/fix: none \(no safe deterministic repair\)/gu)?.length, 2)
  assert.equal(output.match(/validate: pnpm edge:check/gu)?.length, 2)
})

test("keeps subprocess execution failures native", () => {
  const missing = spawnSync("momi-missing-edge-check-command")
  const failed = spawnSync(process.execPath, ["--eval", "process.exit(2)"])

  assert.equal((missing.error as NodeJS.ErrnoException | undefined)?.code, "ENOENT")
  assert.equal(isEdgeFunctionCheckDiagnosticApplicable(missing), false)
  assert.equal(failed.status, 2)
  assert.equal(isEdgeFunctionCheckDiagnosticApplicable(failed), true)
  assert.equal(isEdgeFunctionCheckDiagnosticApplicable(failed, false), false)
})
