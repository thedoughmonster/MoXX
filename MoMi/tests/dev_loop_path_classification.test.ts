import assert from "node:assert/strict"
import test from "node:test"

import { classifyPath } from "../scripts/dev_loop/classify_path.ts"

test("classifies repository agent skills as tooling impact", () => {
  assert.equal(
    classifyPath(".agents/skills/develop-repository-change/SKILL.md"),
    "repository_tooling",
  )
})

test("classifies native Dependabot configuration as tooling impact", () => {
  assert.equal(
    classifyPath(".github/dependabot.yml"),
    "repository_tooling",
  )
})

test("classifies local operator tools as repository tooling", () => {
  assert.equal(
    classifyPath("local-tools/preorder-config/main.ts"),
    "repository_tooling",
  )
})

test("classifies external function authorities as architecture", () => {
  assert.equal(
    classifyPath("external-functions/external-v1.json"),
    "architecture",
  )
})
