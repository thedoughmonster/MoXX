import assert from "node:assert/strict"
import test from "node:test"

import { classifyPath } from "../scripts/dev_loop/classify_path.ts"

test("classifies repository agent skills as tooling impact", () => {
  assert.equal(
    classifyPath(".agents/skills/develop-repository-change/SKILL.md"),
    "repository_tooling",
  )
})
