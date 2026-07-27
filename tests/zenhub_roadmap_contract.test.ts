import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parseRoadmapContract } from "../scripts/zenhub_roadmap_sync/parse_roadmap_contract.ts"
import { roadmapIncludesIssue } from "../scripts/zenhub_roadmap_sync/roadmap_includes_issue.ts"
import { roadmapTitle } from "../scripts/zenhub_roadmap_sync/roadmap_title.ts"

test("the checked-in roadmap contract has one explicit deterministic order", async () => {
  const value = JSON.parse(await readFile(".github/codex/zenhub-roadmap.config.json", "utf8"))
  const contract = parseRoadmapContract(value)
  assert.equal(roadmapTitle(contract.initiative), "00 · Dough Monster development roadmap")
  assert.deepEqual(
    contract.projects.map(({ issue_number, order }) => [issue_number, order]),
    [
      [128, "01A"],
      [156, "01B"],
      [167, "02A"],
      [166, "02B"],
      [162, "03A"],
      [164, "03B"],
      [163, "04"],
      [165, "05"],
      [168, "06"],
      [169, "07"],
    ],
  )
  assert.equal(roadmapIncludesIssue(contract, 208), true)
  assert.equal(roadmapIncludesIssue(contract, 128), true)
  assert.equal(roadmapIncludesIssue(contract, 999), false)
})

test("roadmap parsing fails closed on ambiguity or unknown fields", () => {
  const valid = {
    $schema: "./zenhub-roadmap.schema.json",
    schema_version: 1,
    initiative: { issue_number: 208, order: "00", title: "Roadmap" },
    projects: [
      { issue_number: 10, order: "01A", title: "First" },
      { issue_number: 11, order: "01B", title: "Second" },
    ],
  }
  const duplicateOrder = structuredClone(valid)
  duplicateOrder.projects[1]!.order = "01A"
  assert.throws(() => parseRoadmapContract(duplicateOrder), /orders must be unique/)
  const duplicateIssue = structuredClone(valid)
  duplicateIssue.projects[1]!.issue_number = 10
  assert.throws(() => parseRoadmapContract(duplicateIssue), /issue numbers must be unique/)
  const unknownField = structuredClone(valid) as typeof valid & { inferred_type?: string }
  unknownField.inferred_type = "Project"
  assert.throws(() => parseRoadmapContract(unknownField), /unknown keys: inferred_type/)
})
