import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const modelPath = process.argv[2]
assert.ok(modelPath, "model JSON path is required")

const projects = JSON.parse(readFileSync(modelPath, "utf8"))
const lifecycleTags = new Set(["discovery", "planned", "implemented"])
const ownershipTags = new Set(["moxx-owned", "managed-platform", "third-party"])
const failures = []
let elementCount = 0
const uniqueProjects = new Map()

for (const project of projects) {
  const projectId = project.projectId ?? project.project?.id ?? "default"
  const existing = uniqueProjects.get(projectId)
  if (existing) {
    assert.deepEqual(
      project.elements ?? {},
      existing.elements ?? {},
      `LikeC4 exported conflicting copies of project ${projectId}`,
    )
    continue
  }
  uniqueProjects.set(projectId, project)
}

for (const project of uniqueProjects.values()) {
  for (const [id, element] of Object.entries(project.elements ?? {})) {
    elementCount += 1
    const present = (element.tags ?? []).filter((tag) => lifecycleTags.has(tag))
    if (present.length !== 1) {
      failures.push(`${id}: expected exactly one lifecycle tag, found ${present.length}`)
    }
    const owners = (element.tags ?? []).filter((tag) => ownershipTags.has(tag))
    if (owners.length !== 1) {
      failures.push(`${id}: expected exactly one ownership tag, found ${owners.length}`)
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Invalid architecture lifecycle tags:\n${failures.join("\n")}`)
}

process.stdout.write(
  `Validated one lifecycle tag and one ownership tag on ${elementCount} elements.\n`,
)
