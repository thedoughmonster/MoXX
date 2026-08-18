import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { hashText } from "../dev_loop/hash_text.ts"
import type { FunctionCapabilityModel } from
  "./function_capability_model_types.ts"

export function digestFunctionCapabilityModel(
  model: Omit<FunctionCapabilityModel, "digest"> | FunctionCapabilityModel,
): string {
  const { digest: _digest, ...payload } = model as FunctionCapabilityModel
  return hashText(canonicalJson(payload))
}
