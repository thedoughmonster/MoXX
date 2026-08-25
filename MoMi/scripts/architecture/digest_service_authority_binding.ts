import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { hashText } from "../dev_loop/hash_text.ts"
import type { ServiceAuthorityBinding } from
  "./service_authority_binding_types.ts"

export function digestServiceAuthorityBinding(
  binding: ServiceAuthorityBinding,
): string {
  const source = structuredClone(binding) as unknown as Record<string, unknown>
  delete source.$schema
  delete source.binding_digest
  return hashText(canonicalJson(source))
}
