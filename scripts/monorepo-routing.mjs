import { spawnSync } from "node:child_process"
import { appendFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

const MOMI_PREFIX = "MoMi/"
const MOXI_PREFIX = "MoXi/"

export function classifyPath(path) {
  if (path.startsWith(MOMI_PREFIX)) return "momi"
  if (path.startsWith(MOXI_PREFIX)) return "moxi"
  return "root"
}

export function classifyPaths(paths) {
  const normalized = [...new Set(paths.map((path) => path.trim()).filter(Boolean))]
  const momi = normalized.some((path) => classifyPath(path) === "momi")
  const moxi = normalized.some((path) => classifyPath(path) === "moxi")
  return {
    paths: normalized,
    momi,
    moxi,
    root: normalized.some((path) => classifyPath(path) === "root"),
    cross: momi && moxi,
  }
}

export function hasExplicitInterfaceStatement(body) {
  const match = body.match(/^Interface impact:\s*(.+)$/im)
  if (!match) return false
  const statement = match[1].trim().toLowerCase()
  return !["", "none", "n/a", "not applicable"].includes(statement)
}

export function assertRoutingPolicy(paths, body = "") {
  const selection = classifyPaths(paths)
  if (selection.cross && !hasExplicitInterfaceStatement(body)) {
    throw new Error(
      "Changes spanning MoMi/ and MoXi/ require an explicit Interface impact statement",
    )
  }
  return selection
}

export function changedPaths(base, head) {
  const result = spawnSync("git", ["diff", "--name-only", base, head], {
    encoding: "utf8",
  })
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to resolve changed paths")
  }
  return result.stdout.split("\n").filter(Boolean)
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag)
  return index === -1 ? undefined : process.argv[index + 1]
}

function main() {
  const base = valueAfter("--base")
  const head = valueAfter("--head")
  if (!base || !head) throw new Error("--base and --head are required")
  const selection = assertRoutingPolicy(
    changedPaths(base, head),
    process.env.MOXX_PR_BODY ?? "",
  )
  const output = valueAfter("--github-output")
  const pairs = ["momi", "moxi", "root", "cross"].map(
    (key) => `${key}=${selection[key]}`,
  )
  if (output) appendFileSync(output, `${pairs.join("\n")}\n`)
  process.stdout.write(`${JSON.stringify(selection, null, 2)}\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main()
}
