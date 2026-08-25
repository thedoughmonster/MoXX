import assert from "node:assert/strict"
import test from "node:test"

import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import type { DatabaseObjectAuthority } from
  "../scripts/architecture/database_object_authority_types.ts"
import { findDatabaseObjectAuthorityRatchetDiagnostics } from
  "../scripts/architecture/find_database_object_authority_ratchet_diagnostics.ts"
import { findDatabaseObjectAuthorityViolations } from
  "../scripts/architecture/find_database_object_authority_violations.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"

type Tuple = [string, "database.read" | "database.write", "broad" | "exact", string]

function authorityFrom(tuples: Tuple[]): DatabaseObjectAuthority {
  return {
    schema_version: "database-object-authority/v1", repository: "owner/repo",
    revision: "a".repeat(40), source_digest: "b".repeat(64),
    authority_digest: "c".repeat(64), objects: [], migration_ownership: [],
    public_mappings: [], legacy_debt_reference: { path: "debt.json",
      schema_version: "debt/v1", digest: "d".repeat(64) },
    runtime_compatibility: tuples.map(([service, source_mode, kind, value], index) => {
      const [schema, name] = value.split(".")
      return { service, source_mode, source_path: `${service}.json`,
        json_pointer: `/database/${index}`,
        scope: kind === "broad"
          ? { kind: "historical_broad_migration_debt" as const, schema: value }
          : { kind: "exact_object" as const,
            object: { class: "relation" as const, schema: schema!, name: name! } } }
    }),
  }
}

test("applies the candidate-scoped broad ratchet with one-code precedence", async () => {
  const fixture = await readJson<{ cases: Array<{ name: string; base: Tuple[];
    candidate: Tuple[]; expected: string[] }> }>(
      `${workspaceRoot}/tests/fixtures/database-object-authority/ratchet-cases.json`,
    )
  for (const subject of fixture.cases) {
    const diagnostics = findDatabaseObjectAuthorityRatchetDiagnostics(
      authorityFrom(subject.base), authorityFrom(subject.candidate),
    )
    assert.deepEqual(diagnostics.map((item) => item.code), subject.expected,
      subject.name)
  }
})

test("sorts repeated multi-error ratchet diagnostics deterministically", () => {
  const candidate = authorityFrom([
    ["svc-z", "database.read", "broad", "momi_z"],
    ["svc-a", "database.write", "broad", "momi_a"],
  ])
  const first = findDatabaseObjectAuthorityRatchetDiagnostics(
    authorityFrom([]), candidate,
  )
  candidate.runtime_compatibility.reverse()
  const second = findDatabaseObjectAuthorityRatchetDiagnostics(
    authorityFrom([]), candidate,
  )
  assert.equal(canonicalJson(first), canonicalJson(second))
})

test("reports an unavailable trusted base as indeterminate", async () => {
  const diagnostics = await findDatabaseObjectAuthorityViolations(
    workspaceRoot, "refs/heads/does-not-exist", "HEAD",
  )
  assert.equal(JSON.parse(diagnostics[0]!).code, "ratchet_baseline_unavailable")
})
