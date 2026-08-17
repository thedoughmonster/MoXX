import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import type { ExecutionAuthority } from
  "../scripts/architecture/execution_authority_types.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import { validateExecutionAuthority } from
  "../scripts/architecture/validate_execution_authority.ts"
import {
  context, fixtureRoot, schema,
} from "./execution_authority_test_support.ts"

test("recursive directory grants reject descendant symlink escape", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "momi-authority-root-"))
  const outside = await mkdtemp(join(tmpdir(), "momi-authority-outside-"))
  t.after(async () => {
    await rm(root, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  })
  await mkdir(join(root, "scope"))
  await symlink(outside, join(root, "scope", "escape"))
  const grant = await readJson<ExecutionAuthority>(
    join(fixtureRoot, "zero-authority.json"),
  )
  grant.filesystem.read.push({
    path: "scope",
    kind: "directory",
    recursive: true,
  })
  const diagnostics = await validateExecutionAuthority(
    grant, schema, { ...context, root },
  )
  assert(diagnostics.some((item) => item.code === "symlink_escape"))
})
