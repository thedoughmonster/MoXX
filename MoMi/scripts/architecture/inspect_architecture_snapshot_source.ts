import { spawnSync } from "node:child_process"
import { join } from "node:path"

import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type {
  ArchitectureSnapshotDiagnostic,
  ArchitectureSnapshotSource,
} from "./architecture_snapshot_identity_types.ts"
import { readJson } from "./read_json.ts"
import {
  repositoryAuthority,
  repositoryAuthorityBranch,
} from "./repository_authority.ts"

export async function inspectArchitectureSnapshotSource(
  root: string,
): Promise<ArchitectureSnapshotSource> {
  const diagnostics: ArchitectureSnapshotDiagnostic[] = []
  const env = { ...process.env }
  delete env.SUPABASE_DB_PASSWORD
  delete env.PGPASSWORD
  const options = { cwd: root, encoding: "utf8" as const, env }
  const status = spawnSync("git", [
    "status", "--porcelain=v1", "-z", "--untracked-files=all",
  ], options)
  if (status.status !== 0) diagnostics.push({
    code: "source_unavailable", field_path: "/checkout",
    expected: "git status success", actual: String(status.stderr || status.error),
  })
  else if (String(status.stdout).length > 0) diagnostics.push({
    code: "checkout_dirty", field_path: "/checkout/status",
    expected: "clean", actual: "dirty",
  })
  const head = spawnSync(
    "git", ["rev-parse", "--verify", "HEAD^{commit}"], options,
  )
  const commit = String(head.stdout ?? "").trim()
  if (head.status !== 0 || !/^[0-9a-f]{40}$/.test(commit)) diagnostics.push({
    code: "commit_invalid", field_path: "/commit",
    expected: "40 lowercase hexadecimal characters", actual: commit,
  })
  const origin = spawnSync("git", ["remote", "get-url", "origin"], options)
  const originUrl = String(origin.stdout ?? "").trim()
  const repository = originUrl.replace(/^git@github\.com:/, "")
    .replace(/^ssh:\/\/git@github\.com\//, "")
    .replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "")
  if (origin.status !== 0 || repository !== repositoryAuthority) {
    diagnostics.push({
      code: "repository_mismatch", field_path: "/repository",
      expected: repositoryAuthority, actual: repository || originUrl,
    })
  }
  const workspace = await readJson<{
    environments?: { dev?: { branch?: unknown } }
  }>(join(root, "workspace.json"))
  if (workspace.environments?.dev?.branch !== repositoryAuthorityBranch) {
    diagnostics.push({
    code: "branch_mismatch", field_path: "/branch",
      expected: repositoryAuthorityBranch,
      actual: workspace.environments?.dev?.branch,
    })
  }
  const branch = spawnSync("git", ["branch", "--show-current"], options)
  const currentBranch = String(branch.stdout ?? "").trim()
  if (branch.status !== 0 || currentBranch !== repositoryAuthorityBranch) {
    diagnostics.push({
    code: "branch_mismatch", field_path: "/checkout/branch",
      expected: repositoryAuthorityBranch, actual: currentBranch || "detached",
    })
  }
  const ref = spawnSync(
    "git", ["rev-parse", "--verify", "refs/remotes/origin/dev^{commit}"], options,
  )
  const authoritativeCommit = String(ref.stdout ?? "").trim()
  if (ref.status !== 0 || !/^[0-9a-f]{40}$/.test(authoritativeCommit)) {
    diagnostics.push({
      code: "authoritative_ref_missing", field_path: "/authoritative_ref",
      expected: "refs/remotes/origin/dev", actual: authoritativeCommit || "missing",
    })
  } else if (/^[0-9a-f]{40}$/.test(commit) && spawnSync("git", [
    "merge-base", "--is-ancestor", commit, authoritativeCommit,
  ], options).status !== 0) diagnostics.push({
    code: "commit_not_authoritative", field_path: "/commit",
    expected: `ancestor of ${authoritativeCommit}`, actual: commit,
  })
  const service = await readJson<{
    $id?: unknown
    properties?: { schema_version?: { const?: unknown } }
  }>(join(root, "schemas", "service-manifest-v1.schema.json"))
  if (service.$id !==
    "https://momi.local/schemas/service-manifest-v1.schema.json") {
    diagnostics.push({
      code: "schema_mismatch", field_path: "/service_manifest_schema/id",
      expected: "https://momi.local/schemas/service-manifest-v1.schema.json",
      actual: service.$id,
    })
  }
  if (service.properties?.schema_version?.const !== 1) diagnostics.push({
    code: "schema_mismatch", field_path: "/service_manifest_schema/version",
    expected: 1, actual: service.properties?.schema_version?.const,
  })
  const fn = await readJson<{ $id?: unknown }>(
    join(root, "schemas", "function-manifest-v1.schema.json"),
  )
  const functionVersion = typeof fn.$id === "string"
    ? Number(fn.$id.match(/-v([0-9]+)\.schema\.json$/)?.[1])
    : undefined
  if (fn.$id !==
    "https://momi.local/schemas/function-manifest-v1.schema.json") {
    diagnostics.push({
      code: "schema_mismatch", field_path: "/function_manifest_schema/id",
      expected: "https://momi.local/schemas/function-manifest-v1.schema.json",
      actual: fn.$id,
    })
  }
  if (functionVersion !== 1) diagnostics.push({
    code: "schema_mismatch", field_path: "/function_manifest_schema/version",
    expected: 1, actual: functionVersion,
  })
  diagnostics.sort((a, b) => canonicalJson([
    a.field_path, a.code, a.expected, a.actual,
  ]).localeCompare(canonicalJson([
    b.field_path, b.code, b.expected, b.actual,
  ])))
  return { commit, diagnostics }
}
