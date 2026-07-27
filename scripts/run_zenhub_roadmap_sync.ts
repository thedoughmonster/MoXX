import { readFile } from "node:fs/promises"

import { parseRoadmapContract } from "./zenhub_roadmap_sync/parse_roadmap_contract.ts"
import { roadmapIncludesIssue } from "./zenhub_roadmap_sync/roadmap_includes_issue.ts"
import { syncRoadmap } from "./zenhub_roadmap_sync/sync_roadmap.ts"

const required = [
  "GH_TOKEN",
  "GITHUB_REPOSITORY",
  "GITHUB_REPOSITORY_ID",
  "ZENHUB_API_TOKEN",
  "ZENHUB_WORKSPACE_ID",
] as const
const missing = required.filter((name) => !process.env[name])
if (missing.length) throw new Error(`Missing environment: ${missing.join(", ")}`)

const repositoryGhId = Number(process.env.GITHUB_REPOSITORY_ID)
if (!Number.isSafeInteger(repositoryGhId) || repositoryGhId < 1) {
  throw new Error("GITHUB_REPOSITORY_ID must be a positive integer")
}
const contractPath = new URL("../.github/codex/zenhub-roadmap.config.json", import.meta.url)
const contract = parseRoadmapContract(JSON.parse(await readFile(contractPath, "utf8")))
const requestedNumber = process.env.ZENHUB_ROADMAP_ISSUE_NUMBER?.trim()
const issueNumber = requestedNumber ? Number(requestedNumber) : null
if (issueNumber !== null && (!Number.isSafeInteger(issueNumber) || issueNumber < 1)) {
  throw new Error("ZENHUB_ROADMAP_ISSUE_NUMBER must be blank or a positive integer")
}
if (issueNumber !== null && !roadmapIncludesIssue(contract, issueNumber)) {
  process.stdout.write(`${JSON.stringify({ ignored_issue: issueNumber })}\n`)
} else {
  const result = await syncRoadmap({
    contract,
    githubRepository: process.env.GITHUB_REPOSITORY!,
    githubRepositoryId: repositoryGhId,
    githubToken: process.env.GH_TOKEN!,
    workspaceId: process.env.ZENHUB_WORKSPACE_ID!,
    zenhubToken: process.env.ZENHUB_API_TOKEN!,
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
