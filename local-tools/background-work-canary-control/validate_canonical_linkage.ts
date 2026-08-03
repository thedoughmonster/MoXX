import { isIP } from "node:net"
import { join } from "node:path"

import { canonicalJson } from "./canonical_json.ts"
import { DEV_PROJECT_REF } from "./constants.ts"
import { readBoundedLinkMetadata } from "./read_bounded_link_metadata.ts"
import { resolveIpv4Addresses } from "./resolve_ipv4_addresses.ts"
import {
  LINKED_REF_FILE,
  POOLER_URL_FILE,
} from "./setup_preflight_constants.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"
import type { LinkageEvidence } from "./setup_preflight_types.ts"
import { sha256Text } from "./sha256_text.ts"

export async function validateCanonicalLinkage(
  repositoryRoot: string,
  resolveIpv4: (hostname: string) => Promise<string[]> = resolveIpv4Addresses,
): Promise<LinkageEvidence> {
  let linkedRef: string
  let poolerText: string
  try {
    linkedRef = readBoundedLinkMetadata(join(repositoryRoot, LINKED_REF_FILE), 128).trim()
    poolerText = readBoundedLinkMetadata(join(repositoryRoot, POOLER_URL_FILE), 4 * 1024)
  } catch {
    throw new SetupPreflightError("LinkageMetadataUnsafe", "linkage")
  }
  if (linkedRef !== DEV_PROJECT_REF) {
    throw new SetupPreflightError("LinkageProjectMismatch", "linkage")
  }
  if (poolerText !== poolerText.trim()) {
    throw new SetupPreflightError("LinkageUrlInvalid", "linkage")
  }
  let pooler: URL
  try { pooler = new URL(poolerText) } catch {
    throw new SetupPreflightError("LinkageUrlInvalid", "linkage")
  }
  if (pooler.username !== `postgres.${DEV_PROJECT_REF}`) {
    throw new SetupPreflightError("LinkageProjectMismatch", "linkage")
  }
  const hostname = pooler.hostname.toLowerCase()
  if (!poolerText.startsWith(`postgresql://postgres.${DEV_PROJECT_REF}@`) ||
    pooler.protocol !== "postgresql:" ||
    pooler.password !== "" ||
    !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pooler\.supabase\.com$/.test(hostname) ||
    hostname === `db.${DEV_PROJECT_REF}.supabase.co` || pooler.port !== "5432" ||
    pooler.pathname !== "/postgres" || pooler.search !== "" || pooler.hash !== "") {
    throw new SetupPreflightError("LinkageUrlInvalid", "linkage")
  }
  let addresses: string[]
  try { addresses = await resolveIpv4(hostname) } catch {
    throw new SetupPreflightError("LinkageDnsFailed", "linkage")
  }
  if (!Array.isArray(addresses) || addresses.length < 1 ||
    addresses.some((address) => typeof address !== "string") ||
    !addresses.some((address) => isIP(address) === 4)) {
    throw new SetupPreflightError("LinkageDnsFailed", "linkage")
  }
  return {
    identitySha256: sha256Text(canonicalJson({
      ref: DEV_PROJECT_REF, scheme: pooler.protocol, username: pooler.username,
      hostname, port: pooler.port, path: pooler.pathname,
    })),
    ipv4Resolved: true,
  }
}
