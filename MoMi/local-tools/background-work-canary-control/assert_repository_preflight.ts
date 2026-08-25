import { lstatSync, realpathSync } from "node:fs"
import { isAbsolute, join, resolve } from "node:path"
import { DEV_PROJECT_REF } from "./constants.ts"
import { readBoundedRegularFile } from "./read_bounded_regular_file.ts"
import {
  MAX_REPOSITORY_CONTROL_FILE_BYTES,
  REQUIRED_NODE_VERSION,
  REQUIRED_PNPM_VERSION,
  REQUIRED_RELEASE_BRANCH,
  REQUIRED_SUPABASE_VERSION,
} from "./repository_preflight_constants.ts"
import type {
  RepositoryPreflight,
  RepositoryRuntimeEvidence,
} from "./repository_preflight_types.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function assertRepositoryPreflight(
  repositoryRoot: string,
  evidenceValue: unknown,
  requireLinkedProject = true,
): RepositoryPreflight {
  if (!isAbsolute(repositoryRoot) || resolve(repositoryRoot) !== repositoryRoot) {
    throw new Error("Repository root must be an absolute canonical path")
  }
  const rootStat = lstatSync(repositoryRoot)
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory() ||
    realpathSync(repositoryRoot) !== repositoryRoot) {
    throw new Error("Repository root must be a real directory")
  }
  const evidence = validateStrictRecord(evidenceValue, [
    "nodeVersion", "pnpmVersion", "branch", "headSha", "expectedHeadSha",
    "porcelainStatus", "projectRef",
  ], "Repository runtime evidence") as RepositoryRuntimeEvidence
  if (evidence.nodeVersion !== REQUIRED_NODE_VERSION ||
    evidence.pnpmVersion !== REQUIRED_PNPM_VERSION ||
    evidence.branch !== REQUIRED_RELEASE_BRANCH ||
    evidence.projectRef !== DEV_PROJECT_REF || evidence.porcelainStatus !== "" ||
    !/^[0-9a-f]{40}$/.test(evidence.headSha) ||
    evidence.headSha !== evidence.expectedHeadSha) {
    throw new Error("Repository runtime evidence does not match the released development candidate")
  }
  const read = (relativePath: string) => readBoundedRegularFile(
    join(repositoryRoot, relativePath), MAX_REPOSITORY_CONTROL_FILE_BYTES,
  )
  let packageValue: unknown
  let workspaceValue: unknown
  let installedValue: unknown
  try {
    packageValue = JSON.parse(read("package.json"))
    workspaceValue = JSON.parse(read("workspace.json"))
    installedValue = JSON.parse(read("node_modules/supabase/package.json"))
  } catch {
    throw new Error("Repository version metadata is malformed")
  }
  const pkg = packageValue as Record<string, unknown>
  const engines = pkg.engines as Record<string, unknown> | undefined
  const dependencies = pkg.devDependencies as Record<string, unknown> | undefined
  const workspace = workspaceValue as Record<string, unknown>
  const toolchain = workspace.toolchain as Record<string, unknown> | undefined
  const environments = workspace.environments as Record<string, unknown> | undefined
  const development = environments?.dev as Record<string, unknown> | undefined
  const production = environments?.prod as Record<string, unknown> | undefined
  const installed = installedValue as Record<string, unknown>
  if (pkg.packageManager !== `pnpm@${REQUIRED_PNPM_VERSION}` ||
    engines?.node !== "24.14.x" || engines?.pnpm !== "11.7.x" ||
    dependencies?.supabase !== REQUIRED_SUPABASE_VERSION ||
    toolchain?.node !== REQUIRED_NODE_VERSION || toolchain?.pnpm !== REQUIRED_PNPM_VERSION ||
    toolchain?.supabase_cli !== REQUIRED_SUPABASE_VERSION ||
    development?.branch !== REQUIRED_RELEASE_BRANCH ||
    development?.project_ref !== DEV_PROJECT_REF || production?.branch !== "prod" ||
    typeof production.project_ref !== "string" || production.project_ref === DEV_PROJECT_REF ||
    installed.version !== REQUIRED_SUPABASE_VERSION) {
    throw new Error("Repository version or environment metadata does not match policy")
  }
  const lock = read("pnpm-lock.yaml")
  const importerPin = /\n      supabase:\n        specifier: 2\.109\.1\n        version: 2\.109\.1\n/g
  const packagePin = /\n  supabase@2\.109\.1:\n/g
  if ([...lock.matchAll(importerPin)].length !== 1 ||
    [...lock.matchAll(packagePin)].length !== 2 ||
    !lock.includes("@supabase/cli-linux-x64@2.109.1")) {
    throw new Error("Supabase lockfile pin does not match policy")
  }
  if (requireLinkedProject) {
    const linkedRef = read("supabase/.temp/project-ref")
    if (linkedRef !== DEV_PROJECT_REF && linkedRef !== `${DEV_PROJECT_REF}\n`) {
      throw new Error("Linked Supabase project does not match development")
    }
  }
  return {
    nodeVersion: REQUIRED_NODE_VERSION,
    pnpmVersion: REQUIRED_PNPM_VERSION,
    supabaseCliVersion: REQUIRED_SUPABASE_VERSION,
    branch: REQUIRED_RELEASE_BRANCH,
    headSha: evidence.headSha,
    projectRef: DEV_PROJECT_REF,
  }
}
