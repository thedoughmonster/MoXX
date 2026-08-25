import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const workflowRoot = ".github/workflows"
const expectedWorkflows = [
  "cloudflare-credential-preflight.yml",
  "cloudflare-preview.yml",
  "cloudflare-production.yml",
  "codeql.yml",
  "deploy-dev.yml",
  "deploy-prod.yml",
  "linear-issue-mapping.yml",
  "monorepo-routing.yml",
  "promote-prod.yml",
  "renew-database-access.yml",
  "validate-ui.yml",
  "validate.yml",
]

function read(path) {
  return readFileSync(path, "utf8")
}

const workflowNames = readdirSync(workflowRoot)
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort()
assert.deepEqual(workflowNames, expectedWorkflows)

const workflows = new Map(
  workflowNames.map((name) => [name, read(join(workflowRoot, name))]),
)

for (const [name, source] of workflows) {
  for (const match of source.matchAll(/uses:\s+([^\s#]+)/g)) {
    assert.match(
      match[1],
      /@[0-9a-f]{40}$/,
      `${name} must pin every action to an immutable commit SHA`,
    )
  }
  for (const match of source.matchAll(/secrets\.([A-Za-z0-9_]+)/g)) {
    assert.match(match[1], /^[A-Z][A-Z0-9_]*$/, `${name} has an invalid secret name`)
  }
  assert.doesNotMatch(source, /node-version-file:\s*\.node-version/)
  if (/cache:\s*pnpm/.test(source)) {
    assert.match(
      source,
      /cache-dependency-path:\s*(?:MoMi|MoXi)\/pnpm-lock\.yaml/,
      `${name} must bind the cache to a product lockfile`,
    )
  }
}

for (const name of [
  "deploy-dev.yml",
  "deploy-prod.yml",
  "linear-issue-mapping.yml",
  "renew-database-access.yml",
  "validate.yml",
]) {
  assert.match(workflows.get(name), /working-directory:\s*MoMi/)
}

for (const name of [
  "cloudflare-preview.yml",
  "cloudflare-production.yml",
  "validate-ui.yml",
]) {
  const source = workflows.get(name)
  assert.match(source, /working-directory:\s*MoXi/)
  assert.match(source, /version:\s*10\.0\.0/)
}

assert.match(workflows.get("validate.yml"), /paths:[\s\S]*"MoMi\/\*\*"/)
assert.doesNotMatch(workflows.get("validate.yml"), /"MoXi\/\*\*"/)
assert.match(workflows.get("validate.yml"), /name:\s*validate-final/)
assert.match(workflows.get("validate-ui.yml"), /paths:[\s\S]*"MoXi\/\*\*"/)
assert.doesNotMatch(workflows.get("validate-ui.yml"), /"MoMi\/\*\*"/)

const routing = workflows.get("monorepo-routing.yml")
assert.match(routing, /push:\s*\n\s+branches:\s*\[dev\]/)
assert.match(routing, /github\.event\.head_commit\.message/)
assert.match(routing, /github\.event\.before/)
assert.match(routing, /scripts\/monorepo-routing\.mjs/)
assert.match(routing, /scripts\/validate-monorepo-automation\.mjs/)
assert.match(routing, /node --test tests\/\*\.test\.mjs/)

const applyCallers = [...workflows]
  .filter(([, source]) => source.includes("deploy:apply"))
  .map(([name]) => name)
  .sort()
assert.deepEqual(applyCallers, ["deploy-dev.yml", "deploy-prod.yml"])

for (const name of ["deploy-dev.yml", "deploy-prod.yml"]) {
  const source = workflows.get(name)
  assert.match(source, /node-version-file:\s*MoMi\/\.node-version/)
  assert.match(source, /cache-dependency-path:\s*MoMi\/pnpm-lock\.yaml/)
  assert.match(source, /path:\s*MoMi\/\.momi\/releases\/\*\.json/)
  assert.doesNotMatch(source, /supabase(?:\.cmd)?\s+functions\s+deploy/)
}

const workerMutationCallers = [...workflows]
  .filter(([, source]) => /wrangler (?:deploy|rollback)/.test(source))
  .map(([name]) => name)
  .sort()
assert.deepEqual(workerMutationCallers, [
  "cloudflare-preview.yml",
  "cloudflare-production.yml",
])
assert.match(workflows.get("cloudflare-preview.yml"), /ref:\s*dev/)
assert.match(workflows.get("cloudflare-production.yml"), /ref:\s*prod/)

const dependabot = read(".github/dependabot.yml")
assert.match(dependabot, /directory:\s*\/MoMi/)
assert.match(dependabot, /directory:\s*\/MoXi/)
assert.match(dependabot, /package-ecosystem:\s*github-actions/)
assert.equal((dependabot.match(/target-branch:\s*dev/g) ?? []).length, 3)

const hooks = JSON.parse(read(".codex/hooks.json"))
const hookSource = JSON.stringify(hooks)
assert.match(hookSource, /scripts\/run-momi-codex-hook\.mjs/)
assert.doesNotMatch(hookSource, /\/scripts\/run_codex_migration_guard\.ts/)

const authority = read(`${workflowRoot}/README.md`)
assert.match(authority, /imported[\s\S]*retained[\s\S]*not execution authorities/i)
assert.match(authority, /deploy-dev\.yml[\s\S]*deploy-prod\.yml/)
assert.match(authority, /Linear[\s\S]*sole work-item authority/i)

for (const [name, source] of workflows) {
  assert.doesNotMatch(
    source,
    /^\s+issues:\s*(?:$|read\s*$|write\s*$)/m,
    `${name} must not use GitHub Issues as an active authority`,
  )
  assert.doesNotMatch(source, /github\.rest\.issues/)
  assert.doesNotMatch(source, /MOMI_MODEL_EXECUTION_GATEWAY_URL/)
  assert.doesNotMatch(source, /MOMI_MODEL_GATEWAY_TRIAGE_SECRET/)
}

const linearMapping = workflows.get("linear-issue-mapping.yml")
assert.match(linearMapping, /name:\s*Enforce Linear issue mapping/)
assert.match(linearMapping, /check_pull_request_issue_tracking\.ts/)
assert.doesNotMatch(linearMapping, /pull_request_target:/)

const credentialHelper = read("scripts/provision-mox-392-credentials.sh")
assert.doesNotMatch(credentialHelper, /MOMI_MODEL_EXECUTION_GATEWAY_URL/)
assert.doesNotMatch(credentialHelper, /MOMI_MODEL_GATEWAY_TRIAGE_SECRET/)
assert.match(credentialHelper, /require_secret "CLOUDFLARE_ACCOUNT_ID"/)
assert.equal(
  (credentialHelper.match(/require_secret "SUPABASE_ACCESS_TOKEN"/g) ?? []).length,
  2,
)

const template = read(".github/pull_request_template.md")
assert.match(template, /^Owning Linear issue:\s*MOX-$/m)
assert.doesNotMatch(template, /^Owning issue:\s*#/m)
assert.match(template, /^Interface impact:\s*none$/m)
assert.match(template, /touches both `MoMi\/` and `MoXi\/`/)

process.stdout.write(
  `Validated ${workflowNames.length} root workflows and monorepo governance config.\n`,
)
