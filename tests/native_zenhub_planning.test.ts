import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import test from "node:test"

const hierarchy = "Initiative → Project → Epic → Feature/Task/Bug → Sub-task"
const initiatives = [
  "Customer Ordering & Experience",
  "Payments & Commerce",
  "Kitchen Production & Interfaces",
  "Operations Systems & Automation",
  "Data, Analysis & Reporting",
  "Platform Reliability & Governance",
  "Brand, Marketing & Customer Growth",
]
const forbidden = [
  ".github/codex/zenhub-roadmap.config.json",
  ".github/codex/zenhub-roadmap.schema.json",
  ".github/workflows/sync-zenhub-pipeline.yml",
  ".github/workflows/sync-zenhub-roadmap.yml",
  "scripts/run_zenhub_pipeline_sync.ts",
  "scripts/run_zenhub_roadmap_sync.ts",
]

async function files(directory = "."): Promise<string[]> {
  const found: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue
    const path = directory === "." ? entry.name : `${directory}/${entry.name}`
    if (entry.isDirectory()) found.push(...await files(path))
    else if (entry.isFile()) found.push(path)
  }
  return found
}

test("native Zenhub sync owns progressive planning", async () => {
  const repositoryFiles = await files()
  for (const path of forbidden) assert.ok(!repositoryFiles.includes(path), path)
  assert.ok(!repositoryFiles.some((path) =>
    path.startsWith("scripts/zenhub_pipeline_sync/") ||
    path.startsWith("scripts/zenhub_roadmap_sync/")
  ))

  const agentContract = await readFile("AGENTS.md", "utf8")
  const planning = await readFile("docs/zenhub-planning.md", "utf8")
  assert.ok(agentContract.includes(hierarchy))
  assert.ok(planning.includes(hierarchy))
  for (const initiative of initiatives) {
    assert.ok(planning.includes(`**${initiative}**`))
  }
  assert.match(planning, /MoMi, MoSi, and MoXi product-plane names/u)
  assert.match(planning, /they are not\s+Initiative roots/u)
  assert.match(planning, /Opened contains Levels 1 through 3 only/u)
  assert.match(planning, /Create Level 4 directly in Designing only/u)
  assert.match(planning, /Create Level 5 directly in Designing only/u)
  assert.match(planning, /child never returns to Opened/u)
  assert.match(planning, /Future\s+decomposition candidates/u)
  assert.match(planning, /Premature children are consolidated/u)
  for (const pipeline of [
    "Opened",
    "Discovering",
    "Designing",
    "Building",
    "Finalizing",
  ]) {
    assert.ok(planning.includes(`**${pipeline}:**`))
  }
  assert.match(planning, /lowest issue that accurately owns the pull request/u)
  assert.match(planning, /native repository\s+webhooks/u)
  assert.match(planning, /ADR `0021` owns/u)
})
