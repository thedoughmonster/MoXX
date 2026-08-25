import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import Ajv2020 from "ajv/dist/2020.js"

import { validateJson } from "../scripts/architecture/validate_json.ts"
import { catalogDiagnostic } from "../scripts/diagnostics/catalog_diagnostic.ts"
import { manifestDiagnostic } from "../scripts/diagnostics/manifest_diagnostic.ts"
import { renderRepositoryDiagnostics } from
  "../scripts/diagnostics/render_repository_diagnostics.ts"
import { RepositoryDiagnosticError } from
  "../scripts/diagnostics/repository_diagnostic_error.ts"
import { sourceQualityDiagnostic } from
  "../scripts/diagnostics/source_quality_diagnostic.ts"
import { inspectSourceQualityFile } from
  "../scripts/inspect_source_quality_file.ts"

const schema = JSON.parse(await readFile(
  "schemas/repository-diagnostic-v1.schema.json",
  "utf8",
))
const validate = new Ajv2020({ strict: false }).compile(schema)
const policies = { max_handwritten_lines: 120, hard_max_handwritten_lines: 140 }

test("groups source rule instances and preserves hard and advisory enforcement", () => {
  const source = "export function one() {}\nexport const two = () => 2\n"
  const diagnostics = ["scripts/one.ts", "scripts/two.ts"].map((path) =>
    sourceQualityDiagnostic(inspectSourceQualityFile(path, source, policies)[0])
  )
  const advisory = sourceQualityDiagnostic(inspectSourceQualityFile(
    "notes/large.md",
    "line\n".repeat(121),
    policies,
  )[0])
  for (const diagnostic of [...diagnostics, advisory]) {
    assert.equal(validate(diagnostic), true, JSON.stringify(validate.errors))
    assert.equal(diagnostic.repair.kind, "none")
  }
  const output = renderRepositoryDiagnostics(diagnostics)
  assert.match(output, /SOURCE_MULTIPLE_TOP_LEVEL_FUNCTIONS \(2 instances;/u)
  assert.match(output, /scripts\/one\.ts/u)
  assert.match(output, /scripts\/two\.ts/u)
  assert.equal(diagnostics[0].enforcement, "hard_stop")
  assert.equal(advisory.enforcement, "advisory")
})

test("preserves path-independent TypeScript parser evidence", () => {
  const finding = inspectSourceQualityFile(
    "scripts/broken.ts",
    "export function broken( {\n",
    policies,
  ).find((item) => item.code === "SOURCE_TYPESCRIPT_PARSE_FAILURE")!
  const diagnostic = sourceQualityDiagnostic(finding)
  assert.ok(diagnostic.rationale?.includes("expected"))
  assert.doesNotMatch(diagnostic.rationale ?? "", /scripts\/broken\.ts/u)
  assert.match(renderRepositoryDiagnostics([diagnostic]), /rationale: .*expected/u)
})

test("exposes manifest schema correction without inventing a fix command", () => {
  const path = "services/owner/functions/read-v1/function.json"
  const diagnostic = manifestDiagnostic(
    path,
    "function-manifest-v1.schema.json",
    "required property is absent",
  )!
  assert.equal(validate(diagnostic), true, JSON.stringify(validate.errors))
  assert.match(diagnostic.expected, /owner_service owner/u)
  assert.deepEqual(diagnostic.repair, { kind: "none" })
  assert.equal(diagnostic.validation_command, "pnpm architecture:check")
})

test("propagates manifest diagnostics through the final schema validator", async () => {
  const manifestSchema = JSON.parse(await readFile(
    "schemas/service-manifest-v1.schema.json",
    "utf8",
  ))
  assert.throws(
    () => validateJson(
      manifestSchema,
      {},
      "services/owner/service.json",
    ),
    (error) => {
      assert.ok(error instanceof RepositoryDiagnosticError)
      assert.equal(error.diagnostics[0].rule_id, "MANIFEST_SCHEMA_INVALID")
      return true
    },
  )
})

test("advertises only the catalog's accepted deterministic fix path", () => {
  const diagnostic = catalogDiagnostic("hard_stop")
  assert.equal(validate(diagnostic), true, JSON.stringify(validate.errors))
  assert.deepEqual(diagnostic.repair, {
    kind: "command",
    command: "pnpm catalog:generate",
  })
  assert.equal(diagnostic.validation_command, "pnpm catalog:check")
})
