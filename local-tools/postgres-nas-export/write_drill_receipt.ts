import { randomUUID } from "node:crypto"
import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { DumpManifest, RunState } from "./types.ts"

export async function writeDrillReceipt(
  target: string,
  state: RunState,
  manifest: DumpManifest,
): Promise<void> {
  const directory = join(target, "drills", state.quarter as string)
  await mkdir(directory, { recursive: true })
  const info = await lstat(directory)
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error("Drill receipt directory is unsafe")
  }
  const destination = join(directory, `${state.run_id}.json`)
  try {
    const existingInfo = await lstat(destination)
    if (!existingInfo.isFile() || existingInfo.isSymbolicLink()) {
      throw new Error("Existing drill receipt is unsafe")
    }
    const existing = JSON.parse(await readFile(destination, "utf8")) as Record<string, unknown>
    if (existing.run_id !== state.run_id || existing.archive_id !== state.archive_id ||
      existing.dump_sha256 !== manifest.dump.sha256 || existing.status !== "passed") {
      throw new Error("Existing drill receipt does not match resumed run")
    }
    return
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  const receipt = {
    schema_version: 1,
    run_id: state.run_id,
    quarter: state.quarter,
    environment: state.environment,
    project_ref: state.project_ref,
    archive_id: state.archive_id,
    dump_sha256: manifest.dump.sha256,
    dump_bytes: manifest.dump.bytes,
    schemas: manifest.schemas,
    schema_count: manifest.schemas.length,
    isolated_target: state.isolated_target,
    status: "passed",
    completed_at: new Date().toISOString(),
  }
  const temporary = join(directory, `${state.run_id}.${randomUUID()}.next`)
  await writeFile(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx", mode: 0o600 })
  await rename(temporary, destination)
}
