import { lstatSync, realpathSync } from "node:fs"
import { isAbsolute, join, resolve } from "node:path"
import { assertRepositoryPreflight } from "./assert_repository_preflight.ts"
import { buildSafeChildEnvironment } from "./build_safe_child_environment.ts"
import { DEV_PROJECT_REF } from "./constants.ts"
import { readBoundedRegularFile } from "./read_bounded_regular_file.ts"
import {
  REQUIRED_PNPM_VERSION,
  REQUIRED_RELEASE_BRANCH,
} from "./repository_preflight_constants.ts"
import type { RepositoryPreflight } from "./repository_preflight_types.ts"
import type {
  BoundedChildRunner,
  RuntimeExecutables,
} from "./runtime_adapter_types.ts"

export async function collectRuntimeEvidence(
  repositoryRoot: string,
  executables: RuntimeExecutables,
  runChild: BoundedChildRunner,
  trustedNodeVersion: string = process.versions.node,
  sourceEnvironment: NodeJS.ProcessEnv = process.env,
): Promise<RepositoryPreflight> {
  if (!isAbsolute(repositoryRoot) || resolve(repositoryRoot) !== repositoryRoot ||
    realpathSync(repositoryRoot) !== repositoryRoot) {
    throw new Error("Released repository root is invalid")
  }
  const root = lstatSync(repositoryRoot)
  if (!root.isDirectory() || root.isSymbolicLink()) {
    throw new Error("Released repository root is invalid")
  }
  const environment = buildSafeChildEnvironment(sourceEnvironment)
  const run = async (executable: string, args: readonly string[]): Promise<string> => {
    const result = await runChild({ executable, arguments: args, environment })
    if (result.outcome.status !== "success" || result.outcome.exitCode !== 0 ||
      result.stdout.byteLength > 64 * 1024) {
      throw new Error("Released-candidate evidence command failed")
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(result.stdout)
    } catch {
      throw new Error("Released-candidate evidence output is invalid")
    }
  }
  const pnpmOutput = await run(executables.pnpmExecutable, ["--version"])
  const branchOutput = await run(executables.gitExecutable,
    ["-C", repositoryRoot, "symbolic-ref", "--short", "HEAD"])
  const headOutput = await run(executables.gitExecutable,
    ["-C", repositoryRoot, "rev-parse", "HEAD"])
  const expectedHeadOutput = await run(executables.gitExecutable,
    ["-C", repositoryRoot, "rev-parse", "refs/remotes/origin/dev"])
  const porcelainStatus = await run(executables.gitExecutable,
    ["-C", repositoryRoot, "status", "--porcelain=v1", "--untracked-files=all"])
  const linkedRefPath = join(repositoryRoot, "supabase/.temp/project-ref")
  const linkedOutput = readBoundedRegularFile(linkedRefPath, 128)
  if (pnpmOutput !== `${REQUIRED_PNPM_VERSION}\n` ||
    branchOutput !== `${REQUIRED_RELEASE_BRANCH}\n` ||
    !/^[0-9a-f]{40}\n$/.test(headOutput) ||
    !/^[0-9a-f]{40}\n$/.test(expectedHeadOutput) || porcelainStatus !== "" ||
    ![DEV_PROJECT_REF, `${DEV_PROJECT_REF}\n`].includes(linkedOutput)) {
    throw new Error("Released linked project evidence is invalid")
  }
  return assertRepositoryPreflight(repositoryRoot, {
    nodeVersion: trustedNodeVersion,
    pnpmVersion: pnpmOutput.slice(0, -1),
    branch: branchOutput.slice(0, -1),
    headSha: headOutput.slice(0, -1),
    expectedHeadSha: expectedHeadOutput.slice(0, -1),
    porcelainStatus,
    projectRef: DEV_PROJECT_REF,
  })
}
