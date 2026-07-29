import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import test from "node:test"

const hierarchy = "Initiative → Project → Epic → Feature/Task/Bug → Sub-task"
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

test("native Zenhub sync owns planning projection", async () => {
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
  for (const initiative of ["MoMi", "MoSi", "MoXi"]) {
    assert.ok(planning.includes(`**${initiative}**`))
  }
  assert.match(planning, /MoSi.*Monster Sensory Infrastructure/u)
  assert.match(planning, /MoXi.*Monster Experience Interface/u)
  assert.match(planning, /follows ADR `0018`/u)
  assert.match(planning, /existing issue types without renaming/u)
  assert.match(planning, /Sub-tasks to expose meaningful Feature steps/u)
  assert.match(planning, /lowest issue that accurately owns the pull request/u)
  assert.match(planning, /native repository\s+webhooks/u)
  assert.match(planning, /must not block repository work/u)
})
