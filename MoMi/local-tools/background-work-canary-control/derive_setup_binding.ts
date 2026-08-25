import { canonicalJson } from "./canonical_json.ts"
import { DEV_PROJECT_REF } from "./constants.ts"
import { REQUIRED_SUPABASE_NATIVE_SHA256 } from "./repository_preflight_constants.ts"
import type { RepositoryPreflight } from "./repository_preflight_types.ts"
import type {
  FlockCapabilityEvidence,
  LinkageEvidence,
  SetupBinding,
} from "./setup_preflight_types.ts"
import { sha256Text } from "./sha256_text.ts"
import { verifySqlArtifact } from "./verify_sql_artifact.ts"

export function deriveSetupBinding(
  repositoryRoot: string,
  repository: RepositoryPreflight,
  linkage: LinkageEvidence,
  flock: FlockCapabilityEvidence,
): SetupBinding {
  const fast = verifySqlArtifact(repositoryRoot, "fast")
  const resource = verifySqlArtifact(repositoryRoot, "resource")
  return {
    releaseSha: repository.headSha,
    projectIdentitySha256: sha256Text(canonicalJson({ projectRef: DEV_PROJECT_REF })),
    linkageIdentitySha256: linkage.identitySha256,
    flockCapabilitySha256: flock.identitySha256,
    queryIdentitySha256: sha256Text(canonicalJson({
      fast: fast.sha256, resource: resource.sha256,
    })),
    nativeCliSha256: REQUIRED_SUPABASE_NATIVE_SHA256,
    nodeVersion: repository.nodeVersion,
    pnpmVersion: repository.pnpmVersion,
    supabaseCliVersion: repository.supabaseCliVersion,
  }
}
