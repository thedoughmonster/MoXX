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
  const mapping = ["linear", "issue", "mapping"].join("-")
  const debtIssues = ["debt", "lifecycle", "issues"].join("-")
  const trackingCheck = ["check", "pull", "request", "issue", "tracking"]
    .join("_")
  const remediationIssue = ["remediation", "issue"].join("[_\\s-]+")
  const removed = [
    `.github/workflows/${ledger}.yml`,
    `.github/workflows/${triage}.yml`,
    `.github/workflows/${debtIssues}.yml`,
    `docs/development-${ledger}.md`,
    "docs/zen" + "hub-planning.md",
    `../.github/workflows/${mapping}.yml`,
    `../.github/workflows/${debtIssues}.yml`,
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
      assert.doesNotMatch(source, new RegExp(trackingCheck, "i"))
      assert.doesNotMatch(source, new RegExp(remediationIssue, "i"))
      assert.doesNotMatch(source, new RegExp(["Owning", "issue"].join("\\s+"), "i"))
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

test("active contracts omit retired remote issue authority", async () => {
  const paths = [
    "docs/contracts/service-access-debt-baseline-v1.md",
    "docs/contracts/service-test-impact-metadata-v1.md",
  ]
  const contracts = await Promise.all(paths.map((path) => readFile(path, "utf8")))
  const retired = [
    ["remediation", "issue"].join("[_\\s-]+"),
    ["issue", "automation"].join("[_\\s-]+"),
    ["referenced", "issues", "open"].join("\\s+"),
    ["GitHub", "workflow"].join("\\s+"),
  ]
  for (const [index, source] of contracts.entries()) {
    for (const claim of retired) {
      assert.doesNotMatch(source, new RegExp(claim, "i"), paths[index])
    }
  }
  assert.match(contracts[0], /local remediation\s+description/)
  assert.match(contracts[0], /never consult an external work tracker/)
  assert.match(contracts[1], /architecture, docs, manifest,\s+migration,/)
})

test("deployment docs list only live path-scoped impact classes", async () => {
  const deployment = await readFile("docs/deployment.md", "utf8")
  const retired = ["issue", "automation"].join("[_\\s-]+")
  assert.doesNotMatch(deployment, new RegExp(retired, "i"))
  assert.match(deployment, /Docs, workflows, and repository tooling\s+receive the path-scoped gate/)
})
