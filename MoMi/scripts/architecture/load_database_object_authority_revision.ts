import { spawnSync } from "node:child_process"

import { canonicalJson } from "../dev_loop/canonical_json.ts"
import {
  gitRepositoryRoot,
  productPathAtRef,
  stripProductPrefix,
} from "../git_product_layout.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import type {
  AuthoritySourceDescriptor,
  DatabaseObjectAuthorityRevision,
} from "./database_object_authority_types.ts"
import type { ServiceManifest } from "./types.ts"

export function loadDatabaseObjectAuthorityRevision(
  root: string,
  revision: string,
): DatabaseObjectAuthorityRevision {
  const git = (args: string[], input?: string) => {
    const result = spawnSync("git", args, {
      cwd: gitRepositoryRoot,
      encoding: "utf8",
      input,
    })
    if (result.status !== 0) {
      throw new Error((result.stderr || `git ${args[0]} failed`).trim())
    }
    return result.stdout
  }
  const commit = git(["rev-parse", "--verify", `${revision}^{commit}`]).trim()
  const tree = git([
    "ls-tree", "-r", "-z", "--format=%(objectname)%x09%(path)", commit, "--",
    ...[
      "services", "supabase/migrations", "docs/decisions",
      "docs/service-access-debt-baseline.json",
    ].map((path) => productPathAtRef(commit, path)),
  ])
  const entries = tree.split("\0").filter(Boolean).map((row) => {
    const [blob_id, ...pathParts] = row.split("\t")
    return {
      blob_id: blob_id!,
      path: stripProductPrefix(pathParts.join("\t")),
    }
  }).filter(({ path }) =>
    /^services\/[^/]+\/service\.json$/u.test(path) ||
    /^supabase\/migrations\/[^/]+\.sql$/u.test(path) ||
    /^docs\/decisions\/[^/]+\.md$/u.test(path) ||
    path === "docs/service-access-debt-baseline.json"
  ).sort((left, right) => compareUtf16(left.path, right.path))
  const readBlob = (blob: string) => git(["cat-file", "blob", blob])
  const manifests = entries.filter(({ path }) => path.startsWith("services/"))
    .map(({ path, blob_id }) => ({ path, blob_id,
      value: JSON.parse(readBlob(blob_id)) as ServiceManifest }))
  const migrations = entries.filter(({ path }) => path.endsWith(".sql"))
    .map(({ path, blob_id }) => ({ path, blob_id, source: readBlob(blob_id) }))
  const external_relations = entries.filter(({ path }) =>
    path.startsWith("docs/decisions/")).flatMap(({ path, blob_id }) => {
      const source = readBlob(blob_id)
      if (!source.includes("- Status: accepted") ||
        !/extension\s+table/u.test(source)) return []
      return [...source.matchAll(
        /`([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)`[^.\n]{0,120}\bextension-owned\b/gu,
      )].map((match) => ({ path, blob_id, identity: match[1]! }))
    })
  const debtEntry = entries.find(({ path }) =>
    path === "docs/service-access-debt-baseline.json")
  if (!debtEntry) throw new Error("legacy debt baseline is unavailable")
  const debtSource = readBlob(debtEntry.blob_id)
  const debtValue = JSON.parse(debtSource) as { schema_version?: unknown }
  const descriptors: AuthoritySourceDescriptor[] = [
    ...manifests.map(({ path, blob_id }) => ({
      classification: "service_manifest" as const, path, blob_id,
      schema_version: "service-manifest/v1",
    })),
    ...migrations.map(({ path, blob_id }) => ({
      classification: "migration" as const, path, blob_id,
      schema_version: "migration-history/v1",
    })),
    ...external_relations.map(({ path, blob_id }) => ({
      classification: "accepted_decision" as const, path, blob_id,
      schema_version: "accepted-architecture-decision/v1",
    })),
    { classification: "legacy_debt", path: debtEntry.path,
      blob_id: debtEntry.blob_id,
      schema_version: `service-access-debt-baseline/v${debtValue.schema_version}` },
  ]
  const source_descriptors = [...new Map(descriptors.map((item) =>
    [canonicalJson(item), item])).values()].sort((left, right) =>
      compareUtf16(canonicalJson(left), canonicalJson(right)))
  return {
    repository: "thedoughmonster/momi-backend", revision: commit,
    manifests, migrations, external_relations,
    legacy_debt: { path: debtEntry.path, blob_id: debtEntry.blob_id,
      source: debtSource,
      schema_version: `service-access-debt-baseline/v${debtValue.schema_version}` },
    source_descriptors,
  }
}
