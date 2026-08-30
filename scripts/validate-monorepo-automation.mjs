import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const workflowRoot = ".github/workflows"
const expectedWorkflows = [
  "cloudflare-credential-preflight.yml",
  "cloudflare-preview.yml",
  "cloudflare-production.yml",
  "codeql.yml",
  "cutover-equivalence.yml",
  "deploy-dev.yml",
  "deploy-prod.yml",
  "monorepo-routing.yml",
  "promote-prod.yml",
  "supabase-credential-preflight.yml",
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
assert.match(workflows.get("validate.yml"),
  /MOMI_DEV_REF: \$\{\{ github\.event_name == 'pull_request'/)
assert.match(workflows.get("validate.yml"), /pull_request\.base\.ref == 'prod'/)
assert.match(workflows.get("validate.yml"), /pull_request\.head\.ref == 'dev'/)
assert.match(workflows.get("validate.yml"),
  /pull_request\.head\.repo\.full_name == github\.repository/)
assert.match(workflows.get("validate.yml"),
  /pull_request\.head\.sha \|\| github\.event\.pull_request\.base\.sha \|\| inputs\.development_baseline_sha \}\}/)
assert.match(workflows.get("validate-ui.yml"), /paths:[\s\S]*"MoXi\/\*\*"/)
assert.doesNotMatch(workflows.get("validate-ui.yml"), /"MoMi\/\*\*"/)

const routing = workflows.get("monorepo-routing.yml")
assert.match(routing, /name:\s*monorepo-routing/)
assert.match(routing, /name:\s*monorepo-static-config/)
assert.match(routing, /push:\s*\n\s+branches:\s*\[dev\]/)
assert.match(routing, /github\.event\.head_commit\.message/)
assert.match(routing, /github\.event\.before/)
assert.match(routing, /scripts\/monorepo-routing\.mjs/)
assert.match(routing, /scripts\/validate-monorepo-automation\.mjs/)
assert.match(routing, /node --test tests\/\*\.test\.mjs/)

for (const name of [
  "codeql.yml",
  "cutover-equivalence.yml",
  "monorepo-routing.yml",
  "validate-ui.yml",
]) {
  assert.match(workflows.get(name), /concurrency:[\s\S]*cancel-in-progress:\s*true/)
}

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

const cloudflareCredentialPreflight = workflows.get(
  "cloudflare-credential-preflight.yml",
)
assert.match(cloudflareCredentialPreflight, /workflow_dispatch:/)
assert.match(cloudflareCredentialPreflight, /workers\/scripts/)
assert.doesNotMatch(cloudflareCredentialPreflight, /wrangler (?:deploy|rollback)/)

const supabaseCredentialPreflight = workflows.get(
  "supabase-credential-preflight.yml",
)
assert.match(supabaseCredentialPreflight, /workflow_dispatch:/)
assert.match(
  supabaseCredentialPreflight,
  /environment:\s*\$\{\{ inputs\.environment \}\}/,
)
assert.match(supabaseCredentialPreflight, /\/v1\/projects\/\$\{targetProjectRef\}/)
assert.match(supabaseCredentialPreflight, /\/v1\/branches\/\$\{targetProjectRef\}/)
assert.match(supabaseCredentialPreflight, /\/database\/jit/)
assert.match(supabaseCredentialPreflight, /\/jit-access/)
assert.match(supabaseCredentialPreflight, /permanent_database_mapping/)
assert.match(
  supabaseCredentialPreflight,
  /scripts\/assert-supabase-preflight-authority\.mjs/,
)
assert.ok(
  supabaseCredentialPreflight.indexOf("actions/checkout@") <
    supabaseCredentialPreflight.indexOf("Verify exact workflow authority"),
)
assert.ok(
  supabaseCredentialPreflight.indexOf("Verify exact workflow authority") <
    supabaseCredentialPreflight.indexOf("secrets.SUPABASE_ACCESS_TOKEN"),
)
const supabasePreflightAuthority = read(
  "scripts/assert-supabase-preflight-authority.mjs",
)
assert.match(supabasePreflightAuthority, /thedoughmonster\/MoXX/)
assert.match(supabasePreflightAuthority, /workflow_dispatch/)
assert.match(supabasePreflightAuthority, /refs\/heads\/\$\{environment\}/)
assert.match(supabasePreflightAuthority, /supabase-credential-preflight\.yml/)
assert.doesNotMatch(supabaseCredentialPreflight, /on:\s*[\s\S]*schedule:/)
assert.doesNotMatch(
  supabaseCredentialPreflight,
  /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i,
)

assert.equal(workflows.has("renew-database-access.yml"), false)
for (const source of workflows.values()) {
  assert.doesNotMatch(source, /database-access:renew/)
}
assert.doesNotMatch(
  supabaseCredentialPreflight,
  /deploy:apply|database-access:renew|supabase(?:\.cmd)?\s+(?:db|functions)/,
)

const dependabot = read(".github/dependabot.yml")
assert.match(dependabot, /directory:\s*\/MoMi/)
assert.match(dependabot, /directory:\s*\/MoXi/)
assert.match(dependabot, /package-ecosystem:\s*github-actions/)
assert.equal((dependabot.match(/target-branch:\s*dev/g) ?? []).length, 3)
assert.equal((dependabot.match(/interval:\s*weekly/g) ?? []).length, 2)
assert.equal((dependabot.match(/interval:\s*monthly/g) ?? []).length, 1)
assert.match(
  dependabot,
  /package-ecosystem:\s*github-actions[\s\S]*schedule:[\s\S]*interval:\s*monthly/,
)
assert.match(
  dependabot,
  /package-ecosystem:\s*github-actions[\s\S]*groups:[\s\S]*github-actions:[\s\S]*patterns:[\s\S]*-\s*"\*"/,
)

const hooks = JSON.parse(read(".codex/hooks.json"))
const hookSource = JSON.stringify(hooks)
assert.match(hookSource, /scripts\/run-momi-codex-hook\.mjs/)
assert.doesNotMatch(hookSource, /\/scripts\/run_codex_migration_guard\.ts/)

const authority = read(`${workflowRoot}/README.md`)
assert.match(authority, /imported[\s\S]*retained[\s\S]*not execution authorities/i)
assert.match(authority, /deploy-dev\.yml[\s\S]*deploy-prod\.yml/)
assert.match(authority, /Linear[\s\S]*sole work-item authority/i)

const equivalence = workflows.get("cutover-equivalence.yml")
assert.match(equivalence, /pull_request:/)
assert.match(equivalence, /pnpm momi-impact plan/)
assert.match(equivalence, /pnpm run cloudflare:dry-run/)
assert.doesNotMatch(
  equivalence,
  /deploy:apply|database-access:renew|wrangler (?:deploy|rollback)(?! --dry-run)/,
)

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

assert.match(equivalence, /name:\s*cutover-path-classifier/)
assert.match(equivalence, /needs\.changes\.outputs\.backend == 'true'/)
assert.match(equivalence, /needs\.changes\.outputs\.ui == 'true'/)
assert.match(
  equivalence,
  /if test "\$MOXX_EVENT_NAME" != "pull_request"; then[\s\S]*backend=true[\s\S]*ui=true/,
)
assert.match(equivalence, /\.github\/workflows\/cutover-equivalence\.yml/)

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
