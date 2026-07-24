import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

const markers = [
  ["repo", "guard@v1"].join("-"),
  ["repo", "guard@v1"].join("_"),
  ["architect", "handoff@v1"].join("_"),
  ["architect", "@v1"].join(""),
  ["repo", "guard:intake"].join("-"),
  ["momi", "token-economy-addendum"].join("-"),
  ["momi", "project-root-task-authority"].join("-"),
  ["momi", "context pack"].join("-"),
  ["development", "execution", "handoffs.md"].join("-"),
  ["fresh transcript", "free executor"].join("-"),
  ["fresh", "context executor"].join("-"),
  ["Architect", "Repo Guard"].join(" or "),
  ["Use Architect", "unresolved"].join(" for an "),
  ["Use Repo Guard", "high-risk"].join(" for a "),
  ["repo", "guard-delegation"].join("-"),
]

async function collectFiles(directory = "."): Promise<string[]> {
  const paths: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && [".git", ".momi", "node_modules"].includes(entry.name)) {
      continue
    }
    const path = join(directory, entry.name)
    if (entry.isDirectory()) paths.push(...await collectFiles(path))
    else if (entry.isFile()) paths.push(path.replaceAll("\\", "/").replace(/^\.\//, ""))
  }
  return paths
}

test("repository files exclude retired development orchestration", async () => {
  const paths = await collectFiles()
  const findings: string[] = []
  for (const path of paths) {
    const source = path === "tests/retired_development_protocol.test.ts"
      ? ""
      : await readFile(path, "utf8").catch(() => "")
    for (const marker of markers) {
      if (`${path}\n${source}`.includes(marker)) findings.push(`${path}: ${marker}`)
    }
  }
  assert.deepEqual(findings, [])
})
