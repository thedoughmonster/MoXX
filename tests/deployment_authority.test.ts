import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { assertGitHubDeploymentAuthority } from
  "../scripts/deploy/assert_github_deployment_authority.ts"

const validDevRuntime = {
  GITHUB_ACTIONS: "true",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/dev",
  GITHUB_SHA: "abc123",
  MOMI_EXPECTED_SHA: "abc123",
  GITHUB_WORKFLOW_REF:
    "thedoughmonster/momi-backend/.github/workflows/deploy-dev.yml@refs/heads/dev",
}

test("accepts only the matching GitHub deployment workflow", () => {
  assert.doesNotThrow(() => assertGitHubDeploymentAuthority("dev", validDevRuntime))
  assert.doesNotThrow(() => assertGitHubDeploymentAuthority("prod", {
    ...validDevRuntime,
    GITHUB_REF: "refs/heads/prod",
    GITHUB_WORKFLOW_REF:
      "thedoughmonster/momi-backend/.github/workflows/deploy-prod.yml@refs/heads/prod",
  }))
  const invalid = [
    { ...validDevRuntime, GITHUB_ACTIONS: "false" },
    { ...validDevRuntime, GITHUB_EVENT_NAME: "push" },
    { ...validDevRuntime, GITHUB_REF: "refs/heads/prod" },
    { ...validDevRuntime, MOMI_EXPECTED_SHA: "different" },
    { ...validDevRuntime, GITHUB_WORKFLOW_REF:
      "thedoughmonster/momi-backend/.github/workflows/validate.yml@refs/heads/dev" },
  ]
  for (const runtime of invalid) {
    assert.throws(() => assertGitHubDeploymentAuthority("dev", runtime))
  }
  assert.throws(() => assertGitHubDeploymentAuthority("prod", {
    ...validDevRuntime,
    GITHUB_EVENT_NAME: "push",
    GITHUB_REF: "refs/heads/prod",
    GITHUB_WORKFLOW_REF:
      "thedoughmonster/momi-backend/.github/workflows/deploy-prod.yml@refs/heads/prod",
  }))
})

test("keeps deployment apply in the two authorized workflows", async () => {
  const directory = new URL("../.github/workflows/", import.meta.url)
  const names = await readdir(directory)
  const callers: string[] = []
  for (const name of names) {
    const source = await readFile(new URL(name, directory), "utf8")
    if (source.includes("deploy:apply")) callers.push(name)
    assert.doesNotMatch(source, /supabase(?:\.cmd)?\s+functions\s+deploy/)
  }
  assert.deepEqual(callers.sort(), ["deploy-dev.yml", "deploy-prod.yml"])
})

test("requires an exact SHA for solo production promotion", async () => {
  const source = await readFile(
    new URL("../.github/workflows/promote-prod.yml", import.meta.url),
    "utf8",
  )
  assert.match(source, /expected_sha:/)
  assert.match(source, /inputs\.expected_sha/)
  assert.match(source, /--json isDraft/)
  assert.doesNotMatch(source, /reviewDecision/)
  assert.match(source, /origin\/dev:refs\/heads\/prod/)
  assert.doesNotMatch(source, /gh pr close/)
})

test("codifies the supported agent deployment path", async () => {
  const contract = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8")
  const procedure = await readFile(
    new URL("../docs/agent-deployment-procedure.md", import.meta.url),
    "utf8",
  )
  assert.match(contract, /agent-deployment-procedure\.md/)
  assert.match(procedure, /pnpm release:dev/)
  assert.match(procedure, /Never merge or push `prod` directly/)
  assert.match(procedure, /authenticated CLI profile/)
  assert.match(procedure, /OAuth or personal access token/)
  assert.match(procedure, /not the long-lived Postgres role password/)
  assert.match(procedure, /SUPABASE_DB_PASSWORD/)
  assert.match(procedure, /Do not retry through a different deployment authority/)
})

test("keeps function deployment behind the guarded apply entry point", async () => {
  const directory = new URL("../scripts/", import.meta.url)
  const entries = await readdir(directory, { recursive: true, withFileTypes: true })
  const deployCommands: string[] = []
  const deployCallers: string[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue
    const path = join(entry.parentPath, entry.name)
    const source = await readFile(path, "utf8")
    const relative = path.replaceAll("\\", "/").split("/scripts/")[1]
    if (
      /["']functions["']\s*,\s*["']deploy["']/.test(source) ||
      /supabase(?:\.cmd)?\s+functions\s+deploy/.test(source)
    ) {
      deployCommands.push(relative)
    }
    if (/deployFunctions\s*\(/.test(source)) deployCallers.push(relative)
  }
  assert.deepEqual(deployCommands.sort(), ["deploy/deploy_functions.ts"])
  assert.deepEqual(deployCallers.sort(), [
    "deploy/deploy_functions.ts",
    "run_deploy_apply.ts",
  ])
  const apply = await readFile(new URL("../scripts/run_deploy_apply.ts", import.meta.url), "utf8")
  assert.ok(apply.indexOf("assertGitHubDeploymentAuthority") <
    apply.indexOf("deployFunctions(environment"))
})
