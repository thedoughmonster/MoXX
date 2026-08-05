import assert from "node:assert/strict"
import { glob, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { test } from "node:test"

const script = "local:background-work-recovery-classification"
const command = "node local-tools/background-work-canary-control/recovery_classification_main.ts"

test("classification is one exact manual-only development command", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"))
  assert.equal(pkg.scripts[script], command)
  assert.equal(Object.values(pkg.scripts).filter((value) => value === command).length, 1)
  for await (const path of glob([
    ".github/**/*", "services/**/*", "supabase/**/*", "scripts/**/*", "schemas/**/*",
    "pnpm-workspace.yaml", "workspace.json",
  ], { exclude: ["supabase/.temp/**"] })) {
    try {
      const source = await readFile(path, "utf8")
      assert.equal(source.includes(script), false, path)
      assert.equal(source.includes(command), false, path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EISDIR") throw error
    }
  }
})

test("classification composition cannot reach guard or target-changing modules", async () => {
  const root = resolve("local-tools/background-work-canary-control")
  const pending = [resolve(root, "recovery_classification_main.ts")]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const path = pending.pop()!
    if (visited.has(path)) continue
    visited.add(path)
    const source = await readFile(path, "utf8")
    for (const match of source.matchAll(/from "(\.\/.+?)"/g)) {
      const imported = resolve(root, match[1])
      if (imported.startsWith(root)) pending.push(imported)
    }
  }
  for (const forbidden of ["run_recovery_bootstrap.ts", "run_recovery_activation.ts",
    "start_recovery_canary.ts", "monitor_recovery_canary.ts",
    "finalize_recovery_canary.ts", "run_recovery_rollback.ts",
    "run_recovery_cleanup.ts"]) assert.equal([...visited].some((path) => path.endsWith(forbidden)),
      false, forbidden)
  assert.ok([...visited].some((path) => path.endsWith("run_recovery_preflight.ts")))
})
