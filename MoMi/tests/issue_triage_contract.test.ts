import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import Ajv2020 from "ajv/dist/2020.js"

import { loadTriageConfig } from "../scripts/issue_triage/load_triage_config.ts"
import { parseTriage } from "../scripts/issue_triage/parse_triage.ts"
import { relationshipDirections, type IssueTriage } from
  "../scripts/issue_triage/types.ts"
import { safeTextPattern } from "../scripts/issue_triage/validate_triage.ts"

const valid: IssueTriage = {
  schema_version: 1,
  issue_number: 136,
  issue_type: "feature",
  feature: { id: "issue-triage", title: "Automated issue triage" },
  relationships: [],
  safe_parallel: true,
  confidence: "high",
  rationale: "The issue defines bounded feature and dependency triage.",
  labels: ["enhancement"],
}

test("schema, validator, prompt, types, and config retain parity", async () => {
  assert.deepEqual(parseTriage(JSON.stringify(valid)), valid)
  const schema = JSON.parse(
    await readFile(".github/codex/issue-triage.schema.json", "utf8"),
  )
  const prompt = await readFile(".github/codex/issue-triage-prompt.md", "utf8")
  const config = loadTriageConfig()
  assert.equal(new Ajv2020({ strict: false }).compile(schema)(valid), true)
  assert.deepEqual(schema.properties.issue_type.enum, ["bug", "feature"])
  assert.deepEqual(schema.properties.labels.items.enum,
    Object.values(config.labels_by_issue_type).flat().sort())
  const relationship = schema.properties.relationships.items
  assert.equal(relationship.properties.rationale.pattern, safeTextPattern)
  assert.deepEqual(relationship.properties.direction.enum, relationshipDirections)
  assert.equal(relationship.required.includes("direction"), true)
  assert.equal(schema.properties.feature.properties.title.pattern, safeTextPattern)
  assert.equal(schema.properties.rationale.pattern, safeTextPattern)
  assert.match(prompt, /triage_config\.labels_by_issue_type/)
  assert.match(prompt, /declared_relationships/)
  assert.match(prompt, /current_before_related/)
  assert.match(prompt, /Never infer direction from rationale prose/)
})
