import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { extractCodexEditPaths } from
  "../MoMi/scripts/extract_codex_edit_paths.ts"

export async function runMoMiCodexHook(source, phase, root) {
  const event = JSON.parse(source)
  const paths = extractCodexEditPaths(event, root)
  if (!paths.some((path) => path.startsWith("MoMi/"))) return undefined
  if (phase === "pre") {
    const { runCodexMigrationGuard } = await import(
      "../MoMi/scripts/run_codex_migration_guard.ts"
    )
    return runCodexMigrationGuard(source, root)
  }
  if (phase === "post") {
    const { runPostWriteHook } = await import(
      "../MoMi/scripts/run_post_write_diagnostics.ts"
    )
    return await runPostWriteHook(source)
  }
  throw new Error("Expected hook phase pre or post")
}

async function main() {
  let source = ""
  process.stdin.setEncoding("utf8")
  for await (const chunk of process.stdin) source += chunk
  const rootResult = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  })
  if (rootResult.status !== 0 || !rootResult.stdout.trim()) {
    throw new Error("Unable to resolve the MoXX repository root")
  }
  const output = await runMoMiCodexHook(
    source,
    process.argv[2],
    rootResult.stdout.trim(),
  )
  if (output) process.stdout.write(output)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main()
}
