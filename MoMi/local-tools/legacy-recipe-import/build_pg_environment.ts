import {
  DEV_PROJECT_REF, DIRECT_PG_HOST, POOLER_PG_HOST,
} from "./constants.ts"

export function buildPgEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  for (const key of ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"]) {
    if (!source[key]) throw new Error(`${key} must be supplied in the environment`)
  }
  const direct = source.PGHOST === DIRECT_PG_HOST && source.PGUSER === "postgres"
  const pooler = source.PGHOST === POOLER_PG_HOST &&
    source.PGUSER === `postgres.${DEV_PROJECT_REF}`
  if ((!direct && !pooler) || source.PGPORT !== "5432" ||
    source.PGDATABASE !== "postgres") {
    throw new Error("PostgreSQL identity must exactly match the development project")
  }
  if (source.PGSSLMODE !== "verify-full") {
    throw new Error("PGSSLMODE=verify-full is required")
  }
  const environment: NodeJS.ProcessEnv = {}
  for (const key of [
    "SystemRoot", "WINDIR", "TEMP", "TMP", "PATH", "PATHEXT", "COMSPEC",
    "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGSSLMODE",
    "PGSSLROOTCERT", "PGSSLCERT", "PGSSLKEY", "PGCHANNELBINDING",
    "PGTARGETSESSIONATTRS",
  ]) if (source[key]) environment[key] = source[key]
  environment.PGCONNECT_TIMEOUT = "15"
  environment.PGAPPNAME = "momi-local-legacy-recipe-import"
  environment.PGCHANNELBINDING = "require"
  return environment
}
