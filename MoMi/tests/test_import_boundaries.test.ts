import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import type { SourceModule } from "../scripts/architecture/types.ts"
import { extractImports } from "../scripts/architecture/extract_imports.ts"
import { findImportBoundaryViolations } from
  "../scripts/architecture/find_import_boundary_violations.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("forbids runtime modules from importing test code", () => {
  const owner = service("records-owner")
  const module: SourceModule = {
    path: join(owner.directory, "src", "runtime.ts"),
    service_key: owner.manifest.service_key,
    source: "",
    imports: ["../tests/private_sql.ts"],
  }
  assert.ok(findImportBoundaryViolations([module], [owner]).some((item) =>
    item.includes("runtime source must not import test code")
  ))
  module.path = join(owner.directory, "tests", "runtime.test.ts")
  assert.deepEqual(findImportBoundaryViolations([module], [owner]), [])
})

test("rejects template and computed dynamic imports from runtime source", () => {
  const owner = service("records-owner")
  for (const source of [
    "await import(`../tests/private_sql.ts`)",
    "await import(targetModule)",
  ]) {
    const path = join(owner.directory, "src", "runtime.ts")
    const module: SourceModule = {
      path,
      service_key: owner.manifest.service_key,
      source,
      imports: extractImports(path, source),
    }
    assert.ok(findImportBoundaryViolations([module], [owner]).length > 0)
  }
})

test("rejects dynamic import options and unapproved bare aliases", () => {
  const owner = service("records-owner")
  const provider = service("other-owner")
  const path = join(owner.directory, "src", "runtime.ts")
  for (const source of [
    'await import("../../other-owner/src/private.ts", {})',
    'await import("provider/private.ts")',
  ]) {
    const module: SourceModule = {
      path,
      service_key: owner.manifest.service_key,
      source,
      imports: extractImports(path, source),
    }
    assert.ok(findImportBoundaryViolations([module], [owner, provider]).length > 0)
  }
})

test("rejects runtime filesystem loading APIs", () => {
  const owner = service("records-owner")
  for (const api of ["Deno.readFileSync", "Deno.open", "Deno.openSync"]) {
    const module: SourceModule = {
      path: join(owner.directory, "src", "runtime.ts"),
      service_key: owner.manifest.service_key,
      source: `${api}(path)`,
      imports: [],
    }
    assert.match(findImportBoundaryViolations([module], [owner]).join("\n"),
      /must not load source files dynamically/)
  }
})
