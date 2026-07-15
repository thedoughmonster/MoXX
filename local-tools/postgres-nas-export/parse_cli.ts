import type { CliOptions, Operation } from "./types.ts"

export function parseCli(operation: Operation, args: string[]): CliOptions {
  const values: Record<string, string> = {}
  const common = new Set(["--env", "--project-ref", "--target"])
  const extra = operation === "export" ? new Set(["--resume", "--manual-export-dir"]) :
    operation === "verify" ? new Set(["--archive"]) :
    new Set(["--resume", "--archive", "--isolated-target", "--quarter"])
  let mode: "dry-run" | "execute" | undefined

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (token === "--execute" || token === "--dry-run") {
      const nextMode = token.slice(2) as "dry-run" | "execute"
      if (mode) throw new Error("Choose exactly one of --dry-run or --execute")
      mode = nextMode
      continue
    }
    if (!common.has(token) && !extra.has(token)) {
      throw new Error(`Unknown or unsafe option: ${token}`)
    }
    if (Object.hasOwn(values, token)) throw new Error(`Duplicate option: ${token}`)
    const value = args[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`)
    values[token] = value
    index += 1
  }

  for (const required of common) {
    if (!values[required]) throw new Error(`Required option missing: ${required}`)
  }
  if (operation !== "export" && !values["--archive"]) {
    throw new Error("Required option missing: --archive")
  }
  if (operation === "restore-drill") {
    for (const required of ["--isolated-target", "--quarter"]) {
      if (!values[required]) throw new Error(`Required option missing: ${required}`)
    }
  }
  return {
    operation,
    environment: values["--env"] as CliOptions["environment"],
    projectRef: values["--project-ref"],
    target: values["--target"],
    dryRun: mode !== "execute",
    manualExportDir: values["--manual-export-dir"],
    resumeRunId: values["--resume"],
    archiveId: values["--archive"],
    isolatedTarget: values["--isolated-target"],
    quarter: values["--quarter"],
  }
}
