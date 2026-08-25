import assert from "node:assert/strict"
import test from "node:test"

import { manifestDiagnostic } from
  "../scripts/diagnostics/manifest_diagnostic.ts"
import { renderRepositoryDiagnostics } from
  "../scripts/diagnostics/render_repository_diagnostics.ts"

const functionSchema = "function-manifest-v1.schema.json"
const paths = ["read-v1", "read-v2"].map((slug) =>
  `services/owner/functions/${slug}/function.json`
)

test("groups only identical manifest failures while retaining paths", () => {
  const same = paths.map((path) => manifestDiagnostic(
    path,
    functionSchema,
    `${path}: /owner_service must be string`,
  )!)
  const grouped = renderRepositoryDiagnostics(same)
  assert.match(grouped, /MANIFEST_SCHEMA_INVALID \(2 instances;/u)
  for (const path of paths) assert.match(grouped, new RegExp(path, "u"))

  const prefix = "x".repeat(500)
  const different = paths.map((path, index) => manifestDiagnostic(
    path,
    functionSchema,
    `${path}: ${prefix}${index}`,
  )!)
  const separated = renderRepositoryDiagnostics(different)
  assert.equal(separated.match(/MANIFEST_SCHEMA_INVALID \(1 instance;/gu)?.length, 2)
})

test("keeps manifest owner and schema boundaries distinct", () => {
  const diagnostics = [
    manifestDiagnostic(paths[0], functionSchema, `${paths[0]}: invalid`)!,
    manifestDiagnostic(
      "services/other/functions/read-v1/function.json",
      functionSchema,
      "services/other/functions/read-v1/function.json: invalid",
    )!,
    manifestDiagnostic(paths[1], "alternate-function.schema.json", `${paths[1]}: invalid`)!,
  ]
  const output = renderRepositoryDiagnostics(diagnostics)
  assert.equal(output.match(/MANIFEST_SCHEMA_INVALID \(1 instance;/gu)?.length, 3)
})
