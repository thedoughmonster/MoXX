import { spawnSync } from "node:child_process"

export function runLegacyRecipePsql(database: string, sql: string): string {
  const distro = process.env.MOMI_LEGACY_RECIPE_WSL_DISTRO ?? "Ubuntu-24.04"
  const socket = process.env.MOMI_LEGACY_RECIPE_PG_SOCKET ??
    "/tmp/momi-postgres-16/socket"
  const port = process.env.MOMI_LEGACY_RECIPE_PG_PORT ?? "55432"
  const user = process.env.MOMI_LEGACY_RECIPE_PG_USER ?? "zac"
  const result = spawnSync("wsl.exe", [
    "-d", distro, "--", "psql", "-X", "--no-psqlrc",
    "-h", socket, "-p", port, "-U", user, "-d", database,
    "--set", "ON_ERROR_STOP=1", "--quiet", "--tuples-only", "--no-align",
  ], {
    input: sql, encoding: "utf8", windowsHide: true,
    timeout: 300_000, maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Disposable PostgreSQL rejected test SQL: ${String(result.stderr)}`)
  }
  return String(result.stdout).replaceAll("\0", "").trim()
}
