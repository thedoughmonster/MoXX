import { chmod, lstat, mkdtemp, open, realpath, rm } from "node:fs/promises"
import { isAbsolute, join, resolve } from "node:path"
import { CHILD_OUTPUT_LIMIT_BYTES } from "./process_constants.ts"
import { APPROVED_PROVIDER_SQL } from "./provider_sql_registry.ts"
import type {
  ProviderQueryDependencies,
  ProviderQueryRequest,
  ProviderQueryResult,
} from "./runtime_adapter_types.ts"
import { sha256Text } from "./sha256_text.ts"

export async function executeProviderQuery<T>(
  request: ProviderQueryRequest<T>,
  dependencies: ProviderQueryDependencies,
): Promise<ProviderQueryResult<T>> {
  let temporaryDirectory: string | undefined
  let result: ProviderQueryResult<T> = { status: "failure", reason: "adapter_failure" }
  try {
    if (!APPROVED_PROVIDER_SQL.has(request.sql as object) ||
      request.sql.sha256 !== sha256Text(request.sql.sql) ||
      !isAbsolute(request.repositoryRoot) ||
      resolve(request.repositoryRoot) !== request.repositoryRoot ||
      await realpath(request.repositoryRoot) !== request.repositoryRoot ||
      !isAbsolute(dependencies.temporaryRoot) ||
      resolve(dependencies.temporaryRoot) !== dependencies.temporaryRoot ||
      await realpath(dependencies.temporaryRoot) !== dependencies.temporaryRoot) {
      throw new Error()
    }
    const [repository, temporaryRoot] = await Promise.all([
      lstat(request.repositoryRoot),
      lstat(dependencies.temporaryRoot),
    ])
    if (!repository.isDirectory() || repository.isSymbolicLink() ||
      !temporaryRoot.isDirectory() || temporaryRoot.isSymbolicLink()) throw new Error()
    temporaryDirectory = await mkdtemp(join(dependencies.temporaryRoot, "momi-canary-query-"))
    await chmod(temporaryDirectory, 0o700)
    const directory = await lstat(temporaryDirectory)
    if (!directory.isDirectory() || directory.isSymbolicLink() ||
      (directory.mode & 0o777) !== 0o700 || await realpath(temporaryDirectory) !== temporaryDirectory) {
      throw new Error()
    }
    const sqlPath = join(temporaryDirectory, "query.sql")
    const file = await open(sqlPath, "wx", 0o600)
    try {
      await file.writeFile(request.sql.sql, { encoding: "utf8" })
      await file.sync()
    } finally {
      await file.close()
    }
    const sqlFile = await lstat(sqlPath)
    if (!sqlFile.isFile() || sqlFile.isSymbolicLink() || sqlFile.nlink !== 1 ||
      (sqlFile.mode & 0o777) !== 0o600 || await realpath(sqlPath) !== sqlPath) throw new Error()
    const child = await request.provider.runQuery({
      repositoryRoot: request.repositoryRoot,
      sqlPath,
      signal: request.signal,
    })
    if (child.outcome.status !== "success" || child.outcome.exitCode !== 0 ||
      child.stdout.byteLength > CHILD_OUTPUT_LIMIT_BYTES) {
      const reason = child.stdout.byteLength > CHILD_OUTPUT_LIMIT_BYTES
        ? "output_limit" : child.outcome.status === "success"
          ? "exit_failure" : child.outcome.status
      result = { status: "failure", reason }
    } else {
      try {
        result = { status: "success", value: request.parser(child.stdout) }
      } catch {
        result = { status: "failure", reason: "schema_failure" }
      }
    }
  } catch {
    result = { status: "failure", reason: "adapter_failure" }
  }
  if (temporaryDirectory) {
    try {
      await rm(temporaryDirectory, { recursive: true, force: true })
    } catch {
      return { status: "failure", reason: "adapter_failure" }
    }
  }
  return result
}
