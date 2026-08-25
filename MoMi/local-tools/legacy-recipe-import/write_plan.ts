import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { planRoot } from "./plan_root.ts"
import type { LoadedPackage, PlanOutput, PlannedSqlFile, SqlPlan } from "./types.ts"

export async function writePlan(
  pkg: LoadedPackage,
  files: PlannedSqlFile[],
): Promise<PlanOutput> {
  const directory = join(planRoot(), pkg.importRunId)
  await mkdir(directory, { recursive: true })
  const plan: SqlPlan = {
    schema_version: 1,
    import_run_id: pkg.importRunId,
    source_package_id: pkg.manifest.package_id,
    manifest_sha256: pkg.manifestSha256,
    generated_at: pkg.manifest.created_at,
    files: files.map(({ sql: _sql, ...file }) => file),
  }
  const expected = new Set(["plan.json", ...files.map((file) => file.file)])
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink() || !expected.has(entry.name)) {
      throw new Error(`Unexpected checkpoint entry: ${entry.name}`)
    }
  }
  for (const file of files) {
    const path = join(directory, file.file)
    try {
      await writeFile(path, file.sql, { encoding: "utf8", flag: "wx" })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" ||
        await readFile(path, "utf8") !== file.sql) {
        throw new Error(`Existing SQL plan differs: ${file.file}`)
      }
    }
  }
  const planText = `${JSON.stringify(plan, null, 2)}\n`
  const planPath = join(directory, "plan.json")
  try {
    await writeFile(planPath, planText, { encoding: "utf8", flag: "wx" })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" ||
      await readFile(planPath, "utf8") !== planText) {
      throw new Error("Existing plan.json differs from the validated package")
    }
  }
  return { directory, plan }
}
