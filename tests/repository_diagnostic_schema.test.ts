import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import Ajv2020 from "ajv/dist/2020.js"

import type { RepositoryDiagnosticV1 } from
  "../scripts/diagnostics/types.ts"

const schema = JSON.parse(await readFile(
  "schemas/repository-diagnostic-v1.schema.json", "utf8",
))
const diagnostics = JSON.parse(await readFile(
  "tests/fixtures/repository_diagnostics.fixture.json", "utf8",
)) as RepositoryDiagnosticV1[]
const validate = new Ajv2020({ strict: false }).compile(schema)

test("accepts the complete v1 deterministic diagnostic fixture", () => {
  for (const diagnostic of diagnostics) {
    assert.equal(validate(diagnostic), true, JSON.stringify(validate.errors))
  }
  assert.equal(diagnostics[1].location?.line, undefined)
  assert.equal(diagnostics[3].location, undefined)
  assert.equal(diagnostics[0].repair.kind, "none")
  assert.equal(diagnostics[2].repair.kind, "none")
  assert.equal(diagnostics[3].repair.kind, "command")
})

test("keeps deterministic command and no-fix repair states disjoint", () => {
  const noFixWithCommand = {
    ...diagnostics[0], repair: { kind: "none", command: "unsafe --fix" },
  }
  const commandWithoutCommand = {
    ...diagnostics[3], repair: { kind: "command" },
  }
  assert.equal(validate(noFixWithCommand), false)
  assert.equal(validate(commandWithoutCommand), false)
})

test("rejects fabricated or unstable location and fingerprint fields", () => {
  const nullLine = { ...diagnostics[1], location: {
    ...diagnostics[1].location, line: null,
  } }
  const emptyFingerprint = { ...diagnostics[0], fingerprint: {
    ...diagnostics[0].fingerprint, instance: {},
  } }
  assert.equal(validate(nullLine), false)
  assert.equal(validate(emptyFingerprint), false)
})

test("rejects multiline or terminal-controlled commands", () => {
  const multiline = {
    ...diagnostics[3], validation_command: "pnpm quality:check\nmalicious --fix",
  }
  const controlled = {
    ...diagnostics[3], repair: {
      kind: "command", command: "tok\u001b[31men=fixture-command-secret",
    },
  }
  const zeroWidth = {
    ...diagnostics[3], validation_command: "pnpm quality:\u200bcheck",
  }
  const bidi = {
    ...diagnostics[3], repair: {
      kind: "command", command: "pnpm quality:generate\u202e--safe",
    },
  }
  assert.equal(validate(multiline), false)
  assert.equal(validate(controlled), false)
  assert.equal(validate(zeroWidth), false)
  assert.equal(validate(bidi), false)
})
