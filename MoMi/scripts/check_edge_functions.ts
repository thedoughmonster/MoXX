import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { workspaceRoot } from "./architecture/paths.ts"
import { edgeFunctionCheckDiagnostic } from
  "./diagnostics/edge_function_check_diagnostic.ts"
import { isEdgeFunctionCheckDiagnosticApplicable } from
  "./diagnostics/is_edge_function_check_diagnostic_applicable.ts"
import { renderRepositoryDiagnostics } from
  "./diagnostics/render_repository_diagnostics.ts"

const architecture = await validateArchitecture()
const launcher = join(workspaceRoot, "node_modules", "deno", "bin.cjs")
const launcherAvailable = existsSync(launcher)
const environment = {
  ...process.env,
  DENO_DIR: join(workspaceRoot, "node_modules", ".cache", "deno"),
}

for (const loadedFunction of architecture.functions) {
  const config = join(loadedFunction.adapter_directory, "deno.json")
  const entrypoint = join(loadedFunction.adapter_directory, "index.ts")
  const check = spawnSync(process.execPath, [
    launcher,
    "check",
    "--no-lock",
    "--config",
    config,
    entrypoint,
  ], {
    env: environment,
    stdio: "inherit",
  })
  if (check.status !== 0) {
    if (check.error) console.error(check.error)
    if (isEdgeFunctionCheckDiagnosticApplicable(check, launcherAvailable)) {
      process.stderr.write(renderRepositoryDiagnostics([
        edgeFunctionCheckDiagnostic(loadedFunction, "type"),
      ]))
    }
    await new Promise<void>((resolve) => process.stderr.write("", resolve))
    process.exit(check.status ?? 1)
  }
  const lint = spawnSync(
    process.execPath,
    [launcher, "lint", "--config", config, entrypoint, loadedFunction.source_directory],
    { env: environment, stdio: "inherit" },
  )
  if (lint.status !== 0) {
    if (lint.error) console.error(lint.error)
    if (isEdgeFunctionCheckDiagnosticApplicable(lint, launcherAvailable)) {
      process.stderr.write(renderRepositoryDiagnostics([
        edgeFunctionCheckDiagnostic(loadedFunction, "lint"),
      ]))
    }
    await new Promise<void>((resolve) => process.stderr.write("", resolve))
    process.exit(lint.status ?? 1)
  }
}

console.log("Edge Function type and lint checks passed.")
