import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { loadWorkspace } from "../scripts/architecture/load_workspace.ts"
import { classifyHandwrittenLineCount } from "../scripts/classify_handwritten_line_count.ts"

test("source quality uses a 120-line soft limit and 140-line hard limit", async () => {
  const workspace = await loadWorkspace()
  assert.equal(workspace.policies.max_handwritten_lines, 120)
  assert.equal(workspace.policies.hard_max_handwritten_lines, 140)
})

test("the CI quality check reports warnings without turning them into failures", async () => {
  const source = await readFile("scripts/check_source_quality.ts", "utf8")
  assert.match(source, /console\.warn\(`Source quality warnings:/)
  assert.match(source, /if \(violations\.length > 0\)/)
})

test("the line-count boundaries are deterministic", () => {
  assert.equal(classifyHandwrittenLineCount(120, 120, 140), "valid")
  assert.equal(classifyHandwrittenLineCount(121, 120, 140), "warning")
  assert.equal(classifyHandwrittenLineCount(140, 120, 140), "warning")
  assert.equal(classifyHandwrittenLineCount(141, 120, 140), "violation")
})
