import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile, readdir } from "node:fs/promises"
import test from "node:test"

test("repository declares one work authority and one code-evidence authority", async () => {
  const contract = await readFile("AGENTS.md", "utf8")
  assert.match(contract, /Linear is the sole authority for planning and execution work state/)
  assert.match(contract, /GitHub owns branches, PRs, CI, reviews, merge, and release evidence/)
  assert.match(contract, /not a parallel work-state ledger/)
})

test("retired parallel governance surfaces are absent", async () => {
  const ledger = ["issue", "ledger"].join("-")
  const triage = ["issue", "triage"].join("-")
  const removed = [
    `.github/workflows/${ledger}.yml`,
    `.github/workflows/${triage}.yml`,
    `docs/development-${ledger}.md`,
    "docs/zen" + "hub-planning.md",
  ]
  for (const path of removed) assert.equal(existsSync(path), false, path)
  for (const path of ["scripts/issue_" + "tracking", "scripts/issue_" + "triage"]) {
    if (existsSync(path)) assert.deepEqual(await readdir(path), [], path)
  }

  for (const directory of [".github/workflows", "../.github/workflows"]) {
    const workflowNames = await readdir(directory)
    const workflowText = await Promise.all(workflowNames
      .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
      .map((name) => readFile(`${directory}/${name}`, "utf8")))
    for (const source of workflowText) {
      assert.doesNotMatch(source, new RegExp(ledger, "i"))
      assert.doesNotMatch(source, new RegExp(triage, "i"))
    }
  }
})

test("PR template omits retired delivery-proof metadata", async () => {
  const template = await readFile(".github/pull_request_template.md", "utf8")
  const owning = ["Owning", "issue"].join(" ")
  const disposition = ["Dis", "position"].join("")
  assert.doesNotMatch(template, new RegExp(owning, "i"))
  assert.doesNotMatch(template, new RegExp(`^${disposition}:`, "im"))
  assert.match(template, /Linear issue link, when available/)
})
