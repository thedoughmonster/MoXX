import { lstat, realpath } from "node:fs/promises"
import { join, win32 } from "node:path"

import { buildPgEnvironment } from "./build_pg_environment.ts"
import { runProcess } from "./run_process.ts"
import type { PgTools } from "./types.ts"

export async function resolvePgTools(): Promise<PgTools> {
  const directory = process.env.MOMI_PG17_BIN
  if (!directory || !/^[a-zA-Z]:[\\/]/.test(directory) || !win32.isAbsolute(directory)) {
    throw new Error("MOMI_PG17_BIN must be an absolute local Windows directory")
  }
  if (directory.split(/[\\/]/).some((part) => part === "." || part === "..")) {
    throw new Error("MOMI_PG17_BIN cannot contain traversal segments")
  }
  const info = await lstat(directory)
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error("MOMI_PG17_BIN must be a non-symlink directory")
  }
  const resolved = await realpath(directory)
  const actual = win32.normalize(resolved).replace(/[\\/]+$/, "").toLowerCase()
  const expected = win32.normalize(directory).replace(/[\\/]+$/, "").toLowerCase()
  if (actual !== expected) {
    throw new Error("MOMI_PG17_BIN cannot resolve through a symlink or junction")
  }
  const tools: PgTools = {
    pgDump: join(directory, "pg_dump.exe"),
    pgRestore: join(directory, "pg_restore.exe"),
  }
  const environment = buildPgEnvironment("none")
  for (const [name, path] of [["pg_dump", tools.pgDump], ["pg_restore", tools.pgRestore]]) {
    const toolInfo = await lstat(path)
    if (!toolInfo.isFile() || toolInfo.isSymbolicLink()) {
      throw new Error(`${name} must be a regular executable in MOMI_PG17_BIN`)
    }
    const version = runProcess(path, ["--version"], environment, "capture")
    const pattern = name === "pg_dump" ?
      /^pg_dump \(PostgreSQL\) 17(?:\.\d+)*(?:\s|$)/ :
      /^pg_restore \(PostgreSQL\) 17(?:\.\d+)*(?:\s|$)/
    if (!pattern.test(version)) throw new Error(`${name} must report PostgreSQL major version 17`)
  }
  return tools
}
