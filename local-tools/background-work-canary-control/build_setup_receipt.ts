import { canonicalJson } from "./canonical_json.ts"
import type {
  SetupReceiptCore,
  StoredSetupReceipt,
} from "./setup_preflight_types.ts"
import { sha256Text } from "./sha256_text.ts"

export function buildSetupReceipt(core: SetupReceiptCore): StoredSetupReceipt {
  return { ...core, integritySha256: sha256Text(canonicalJson(core)) }
}
