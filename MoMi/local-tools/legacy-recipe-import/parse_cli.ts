import type { CliOptions } from "./types.ts"

export function parseCli(args: string[]): CliOptions {
  const values: Record<string, string> = {}
  const valued = new Set([
    "--mode", "--backend", "--env", "--project-ref", "--source",
  ])
  let dryRun = true
  let selectedMode = false
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (token === "--execute" || token === "--dry-run") {
      if (selectedMode) throw new Error("Choose at most one execution mode")
      dryRun = token !== "--execute"
      selectedMode = true
      continue
    }
    if (!valued.has(token)) throw new Error(`Unknown or unsafe option: ${token}`)
    if (Object.hasOwn(values, token)) throw new Error(`Duplicate option: ${token}`)
    const value = args[index + 1]
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`)
    }
    values[token] = value
    index += 1
  }
  for (const required of ["--env", "--project-ref", "--source"]) {
    if (!values[required]) throw new Error(`Required option missing: ${required}`)
  }
  return {
    mode: (values["--mode"] ?? "import") as CliOptions["mode"],
    backend: (values["--backend"] ?? "supabase-cli") as CliOptions["backend"],
    environment: values["--env"],
    projectRef: values["--project-ref"],
    source: values["--source"],
    dryRun,
  }
}
