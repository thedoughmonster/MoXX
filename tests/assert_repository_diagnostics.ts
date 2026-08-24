import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import Ajv2020 from "ajv/dist/2020.js"

import type { RepositoryDiagnosticV1 } from
  "../scripts/diagnostics/types.ts"

const schema = JSON.parse(await readFile(
  "schemas/repository-diagnostic-v1.schema.json",
  "utf8",
))
const validate = new Ajv2020({ strict: false }).compile(schema)

export function assertRepositoryDiagnostics(
  diagnostics: RepositoryDiagnosticV1[],
): void {
  for (const diagnostic of diagnostics) {
    assert.equal(validate(diagnostic), true, JSON.stringify(validate.errors))
  }
}
