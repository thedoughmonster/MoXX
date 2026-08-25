import { ISOLATED_TARGET_PATTERN } from "./constants.ts"
import type { ConnectionMode } from "./types.ts"

export function buildPgEnvironment(
  mode: ConnectionMode,
  isolatedTarget?: string,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {}
  for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP", "PATH", "PATHEXT", "COMSPEC"]) {
    if (process.env[key]) environment[key] = process.env[key]
  }
  if (mode === "none") return environment
  for (const key of ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"]) {
    if (!process.env[key]) throw new Error(`${key} must be supplied through the process environment`)
  }
  if (!/^\d{1,5}$/.test(process.env.PGPORT ?? "") ||
    Number(process.env.PGPORT) < 1 || Number(process.env.PGPORT) > 65_535) {
    throw new Error("PGPORT must be a valid TCP port")
  }
  if (mode === "restore") {
    const host = process.env.PGHOST?.toLowerCase()
    if (!host || !new Set(["localhost", "127.0.0.1", "::1"]).has(host)) {
      throw new Error("A restore drill may connect only to a loopback PostgreSQL host")
    }
    if (!isolatedTarget || !ISOLATED_TARGET_PATTERN.test(isolatedTarget) ||
      process.env.PGDATABASE !== isolatedTarget) {
      throw new Error("PGDATABASE must exactly match the isolated restore target")
    }
  }
  const pgKeys = [
    "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGSSLMODE",
    "PGSSLROOTCERT", "PGSSLCERT", "PGSSLKEY", "PGCHANNELBINDING",
    "PGTARGETSESSIONATTRS",
  ]
  for (const key of pgKeys) if (process.env[key]) environment[key] = process.env[key]
  environment.PGCONNECT_TIMEOUT = "15"
  environment.PGAPPNAME = `momi-local-${mode}`
  return environment
}
