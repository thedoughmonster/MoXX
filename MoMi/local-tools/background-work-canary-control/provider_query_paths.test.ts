import assert from "node:assert/strict"
import { mkdtemp, readdir, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { createFakeHeldProvider } from "./create_fake_held_provider.test_fixture.ts"
import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { generateCleanupSql } from "./generate_cleanup_sql.ts"
import { VALID_RECOVERY_CONTROL_INPUT } from "./recovery_control.test_fixture.ts"

test("provider adapter rejects symlinked repository and temporary roots", async () => {
  const repository = await mkdtemp(join(tmpdir(), "momi-provider-path-repo-"))
  const temporaryRoot = await mkdtemp(join(tmpdir(), "momi-provider-path-temp-"))
  const repositoryLink = join(tmpdir(), `momi-provider-repo-link-${process.pid}`)
  const temporaryLink = join(tmpdir(), `momi-provider-temp-link-${process.pid}`)
  const sql = createInternalProviderSql("cleanup", generateCleanupSql(
    VALID_RECOVERY_CONTROL_INPUT,
  ))
  let called = false
  const provider = createFakeHeldProvider({ runQuery: async () => {
    called = true
    throw new Error("must not spawn")
  } })
  const dependencies = {
    temporaryRoot,
  }
  try {
    await symlink(repository, repositoryLink, "dir")
    await symlink(temporaryRoot, temporaryLink, "dir")
    const linkedRepository = await executeProviderQuery({
      repositoryRoot: repositoryLink, provider, sql,
      parser: () => "never",
    }, dependencies)
    assert.deepEqual(linkedRepository, { status: "failure", reason: "adapter_failure" })
    const linkedTemporary = await executeProviderQuery({
      repositoryRoot: repository, provider, sql,
      parser: () => "never",
    }, { ...dependencies, temporaryRoot: temporaryLink })
    assert.deepEqual(linkedTemporary, { status: "failure", reason: "adapter_failure" })
    assert.equal(called, false)
    assert.deepEqual(await readdir(temporaryRoot), [])
  } finally {
    await rm(repositoryLink, { force: true })
    await rm(temporaryLink, { force: true })
    await rm(repository, { recursive: true, force: true })
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})
