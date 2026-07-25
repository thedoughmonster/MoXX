import { canonicalJson } from "./canonical_json.ts"
import type { CreateRequest } from "./types.ts"

export async function hashPayload(value: CreateRequest): Promise<string> {
  const semantic = { schema_version: value.schema_version, operation: value.operation,
    purpose_key: value.purpose_key, profile_key: value.profile_key,
    parent_invocation_id: value.parent_invocation_id,
    requested_output_tokens: value.requested_output_tokens,
    background: value.background, payload: value.payload }
  const bytes = new TextEncoder().encode(canonicalJson(semantic))
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0")).join("")
}
