import { publicOriginPolicy } from "../../../src/public_origin.ts"

export function responseHeaders(request: Request): Record<string, string> {
  return publicOriginPolicy.responseHeaders(
    request,
    "content-type, x-momi-recovery-authority",
    "POST, OPTIONS",
  )
}
