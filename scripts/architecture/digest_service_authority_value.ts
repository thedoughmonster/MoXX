import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { hashText } from "../dev_loop/hash_text.ts"

export function digestServiceAuthorityValue(value: unknown): string {
  return hashText(canonicalJson(value))
}
