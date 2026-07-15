export function buildDumpArgs(dumpPath: string, schemas: string[]): string[] {
  const args = [
    "--format=custom",
    "--compress=gzip:9",
    "--strict-names",
    "--no-owner",
    "--no-privileges",
    "--lock-wait-timeout=60000",
    "--file",
    dumpPath,
  ]
  for (const schema of schemas) args.push("--schema", schema)
  return args
}
