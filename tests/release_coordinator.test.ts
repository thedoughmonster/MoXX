import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

test("exposes the replacement tool surface and literal release commands", async () => {
  const json = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts: Record<string, string>
  }
  assert.match(json.scripts["momi-context"], /run_context_pack/)
  assert.match(json.scripts["momi-impact"], /run_impact_plan/)
  assert.match(json.scripts["momi-check"], /run_check_changed/)
  assert.match(json.scripts["momi-receipt"], /run_receipt_summarize/)
  assert.equal(json.scripts["release:dev"], "node scripts/run_release.ts --env dev")
  assert.equal(json.scripts["release:prod"], "node scripts/run_release.ts --env prod")
})

test("keeps migration apply in one model-opaque local coordinator module", async () => {
  const entries = await readdir("scripts", { recursive: true, withFileTypes: true })
  const callers: string[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue
    const path = join(entry.parentPath, entry.name)
    const source = await readFile(path, "utf8")
    if (/["']db["']\s*,\s*["']push["']/.test(source)) {
      callers.push(path.replaceAll("\\", "/").split("/scripts/")[1] ?? path)
    }
  }
  assert.deepEqual(callers, ["scripts/release/apply_migrations.ts"])
})

test("development uses one validation receipt and affected-only deployment", async () => {
  const source = await readFile("scripts/release/release_dev.ts", "utf8")
  assert.match(source, /readValidationReceipt/)
  assert.match(source, /assertValidationJob/)
  assert.match(source, /assertPlanMatchesValidation/)
  assert.match(source, /release\.functions\.length === 0/)
  assert.match(source, /release\.services\.join/)
  assert.match(source, /applyMigrations\("dev", validatedPlan\.impact\.migrations\)/)
  assert.doesNotMatch(source, /scripts\/check|--service|waitForPullRequest/)
})

test("production consumes the exact dev receipt without revalidation", async () => {
  const source = await readFile("scripts/release/release_prod.ts", "utf8")
  assert.match(source, /readReleaseReceipt/)
  assert.match(source, /devReceipt\.head_sha !== head/)
  assert.match(source, /ensurePromotionPullRequest/)
  assert.match(source, /applyMigrations\("prod", devReceipt\.plan\.impact\.migrations\)/)
  assert.match(source, /promote-prod\.yml/)
  assert.match(source, /deploy-prod\.yml/)
  assert.doesNotMatch(source, /scripts\/check|validate\.yml/)
})

test("production deterministically creates or reuses its exact promotion PR", async () => {
  const source = await readFile(
    "scripts/release/ensure_promotion_pull_request.ts",
    "utf8",
  )
  assert.match(source, /"--base", "prod", "--head", "dev"/)
  assert.match(source, /Multiple open dev-to-prod PRs/)
  assert.match(source, /record\.headRefOid !== expectedHeadSha/)
  assert.match(source, /"pr", "ready"/)
})

test("workflow polling is bounded and never shells out to run watch", async () => {
  const source = await readFile("scripts/release/wait_for_workflow.ts", "utf8")
  const finder = await readFile("scripts/release/find_workflow_run.ts", "utf8")
  assert.match(source, /attempt < 90/)
  assert.match(source, /findRequiredJob/)
  assert.match(source, /requiredJobState/)
  assert.doesNotMatch(source, /run", "watch"|while\s*\(true\)/)
  assert.match(finder, /displayTitle/)
  assert.match(finder, /includes\(identity\)/)
})

test("database apply remains outside GitHub workflows", async () => {
  const names = await readdir(".github/workflows")
  for (const name of names) {
    const source = await readFile(`.github/workflows/${name}`, "utf8")
    assert.doesNotMatch(source, /\bdb\s+push\b|\bmigration\s+repair\b/)
  }
})
