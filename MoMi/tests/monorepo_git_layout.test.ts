import assert from "node:assert/strict"
import test from "node:test"

import {
  gitProductPrefix,
  productPathAtRef,
  productSourceCommit,
} from "../scripts/git_product_layout.ts"
import { listChangedPaths } from "../scripts/dev_loop/list_changed_paths.ts"

test("resolves accepted source commits behind monorepo subtree imports", () => {
  assert.equal(gitProductPrefix, "MoMi/")
  assert.equal(productPathAtRef("origin/dev", "workspace.json"), "MoMi/workspace.json")
  assert.equal(
    productSourceCommit("origin/dev"),
    "f52215975104aa8448f9cad4a05945ffe8282b46",
  )
  assert.equal(
    productSourceCommit("origin/prod"),
    "9b2addfcbb99c8f5d83276b4d6475d302b4c8de6",
  )
})

test("reports backend impact paths relative to MoMi", () => {
  const paths = listChangedPaths(
    "cb4070a4d1b0918c96f602ef50e94d9218c23c32",
    "HEAD",
  )
  assert.ok(paths.includes("scripts/run_codex_migration_guard.ts"))
  assert.ok(paths.every((path) => !path.startsWith("MoMi/")))
  assert.ok(paths.every((path) => !path.startsWith("../")))
})
