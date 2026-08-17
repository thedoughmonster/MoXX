import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { findAdrNumberViolations } from
  "../scripts/architecture/find_adr_number_violations.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"

const fixtureRoot = join(
  workspaceRoot,
  "tests",
  "fixtures",
  "adr-number-uniqueness",
)

test("accepts unique ADRs and ignores non-ADR and nested files", async () => {
  const violations = await findAdrNumberViolations(
    join(fixtureRoot, "unique"),
  )

  assert.deepEqual(violations, [])
})

test("reports a duplicate 0018 prefix with every sorted path", async () => {
  const violations = await findAdrNumberViolations(
    join(fixtureRoot, "collisions"),
  )

  assert.equal(
    violations[0],
    "Duplicate ADR prefix 0018: " +
      "docs/decisions/0018-alpha.md, docs/decisions/0018-zeta.md",
  )
})

test("reports a duplicate 0019 prefix with every sorted path", async () => {
  const violations = await findAdrNumberViolations(
    join(fixtureRoot, "collisions"),
  )

  assert.equal(
    violations[1],
    "Duplicate ADR prefix 0019: " +
      "docs/decisions/0019-alpha.md, docs/decisions/0019-middle.md, " +
      "docs/decisions/0019-zeta.md",
  )
})

test("reports every collision group in deterministic order", async () => {
  const violations = await findAdrNumberViolations(
    join(fixtureRoot, "collisions"),
  )

  assert.deepEqual(violations, [
    "Duplicate ADR prefix 0018: " +
      "docs/decisions/0018-alpha.md, docs/decisions/0018-zeta.md",
    "Duplicate ADR prefix 0019: " +
      "docs/decisions/0019-alpha.md, docs/decisions/0019-middle.md, " +
      "docs/decisions/0019-zeta.md",
  ])
})
