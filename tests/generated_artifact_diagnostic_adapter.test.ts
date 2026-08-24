import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import type { CanonicalArtifactGenerator } from
  "../scripts/codex_hooks/types.ts"
import { canonicalGeneratorIdentity } from
  "../scripts/codex_hooks/canonical_generator_identity.ts"
import { generatedArtifactDiagnostic } from
  "../scripts/diagnostics/generated_artifact_diagnostic.ts"
import { renderRepositoryDiagnostics } from
  "../scripts/diagnostics/render_repository_diagnostics.ts"
import type { CheckEnforcement } from "../scripts/dev_loop/check_types.ts"
import { momiFixes } from "../scripts/momi_fix/registrations.ts"
import { assertRepositoryDiagnostics } from
  "./assert_repository_diagnostics.ts"

type ArtifactCase = {
  kind: CanonicalArtifactGenerator
  condition: "freshness" | "validity"
  enforcement: CheckEnforcement
  detail?: string
  safe_repair?: boolean
}
const fixture = JSON.parse(await readFile(
  "tests/fixtures/repository_check_diagnostics.fixture.json", "utf8",
)) as { artifacts: ArtifactCase[] }

test("uses canonical artifact generators for stale and invalid outputs", () => {
  const diagnostics = fixture.artifacts.map((item) =>
    generatedArtifactDiagnostic(
      item.kind, item.condition, item.enforcement, item.detail,
      item.safe_repair,
    )
  )
  assertRepositoryDiagnostics(diagnostics)
  const output = renderRepositoryDiagnostics(diagnostics)
  assert.match(output, /\[hard_stop\] catalog/u)
  assert.match(output, /fix: pnpm catalog:generate/u)
  assert.match(output, /validate: pnpm catalog:check/u)
  assert.match(output, /GENERATED_QUALITY_REPORT_VALIDITY/u)
  assert.match(output, /Reported condition: Quality trend report must be valid JSON/u)
  assert.equal(output.match(/fix: pnpm quality:generate/gu)?.length, 2)
  assert.equal(output.match(/validate: pnpm quality:check/gu)?.length, 2)
  assert.match(output, /\[advisory\] quality-report-freshness/u)
  assert.match(output, /GENERATED_SERVICE_CATALOG_VALIDITY/u)
  assert.match(output, /Restore the service catalog to a readable repository state/u)
  assert.match(output, /fix: none \(no safe deterministic repair\)/u)
})

test("derives validation commands from the canonical fix registration", () => {
  for (const kind of ["catalog", "quality"] as const) {
    const identity = canonicalGeneratorIdentity(kind)
    const diagnostic = generatedArtifactDiagnostic(kind, "validity", "hard_stop")
    assert.equal(identity.validation_command, momiFixes[kind].validation_command)
    assert.equal(diagnostic.validation_command, identity.validation_command)
  }
})
