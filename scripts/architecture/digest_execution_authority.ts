import { createHash } from "node:crypto"

import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type { ExecutionAuthority } from "./execution_authority_types.ts"

export function digestExecutionAuthority(
  authority: ExecutionAuthority,
): string {
  const source = structuredClone(authority) as unknown as Record<string, unknown>
  delete source.$schema
  delete source.source_digest
  return createHash("sha256").update(canonicalJson(source)).digest("hex")
}
