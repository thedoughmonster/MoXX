import { validateArchitecture } from "../architecture/validate_architecture.ts"
import { buildImpactPlan } from "./build_impact_plan.ts"
import { canonicalJson } from "./canonical_json.ts"
import { hashDiff } from "./hash_diff.ts"
import { hashText } from "./hash_text.ts"
import { listChangedPaths } from "./list_changed_paths.ts"
import { readMigrationOwners } from "./read_migration_owners.ts"
import { resolveIdentity } from "./resolve_identity.ts"
import type { BoundPlan } from "./types.ts"

export async function buildBoundPlan(baseRef: string, headRef: string): Promise<BoundPlan> {
  const base = resolveIdentity(baseRef)
  const head = resolveIdentity(headRef)
  const changedPaths = listChangedPaths(base.sha, head.sha)
  const architecture = await validateArchitecture()
  const impact = buildImpactPlan(
    changedPaths,
    architecture,
    readMigrationOwners(changedPaths),
  )
  return {
    schema_version: 1,
    base,
    head,
    changed_paths: changedPaths,
    diff_sha256: await hashDiff(base.sha, head.sha),
    impact_sha256: hashText(canonicalJson(impact)),
    impact,
  }
}
