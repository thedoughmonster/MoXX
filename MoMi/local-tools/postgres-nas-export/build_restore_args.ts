export function buildRestoreArgs(dumpPath: string, database: string): string[] {
  return [
    "--clean",
    "--if-exists",
    "--exit-on-error",
    "--single-transaction",
    "--no-owner",
    "--no-privileges",
    "--dbname",
    database,
    dumpPath,
  ]
}
