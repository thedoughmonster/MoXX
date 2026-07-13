import { execFileSync } from "node:child_process"

export function loadProductionMigrations(
  migrationPath: string,
): Map<string, string> {
  const requested = process.env.MOMI_PROD_REF
  const candidates = requested ? [requested] : ["origin/prod", "prod"]
  for (const reference of candidates) {
    try {
      const output = execFileSync(
        "git",
        ["ls-tree", "-r", "--name-only", reference, "--", migrationPath],
        { encoding: "utf8" },
      )
      const files = output.split(/\r?\n/).filter((path) => path.endsWith(".sql"))
      const sources = new Map<string, string>()
      for (const path of files) {
        const source = execFileSync("git", ["show", `${reference}:${path}`], {
          encoding: "utf8",
        })
        sources.set(path.split("/").at(-1)!, source)
      }
      return sources
    } catch {
      continue
    }
  }
  throw new Error("Unable to read the production migration baseline")
}
