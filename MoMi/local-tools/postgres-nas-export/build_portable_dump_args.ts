export function buildPortableDumpArgs(dumpPath: string, schemas: string[]): string[] {
  const args = [
    "--format=plain",
    "--compress=gzip:9",
    "--strict-names",
    "--no-owner",
    "--no-privileges",
    "--encoding=UTF8",
    "--lock-wait-timeout=60000",
    "--file",
    dumpPath,
  ]
  for (const schema of schemas) args.push("--schema", schema)
  return args
}
