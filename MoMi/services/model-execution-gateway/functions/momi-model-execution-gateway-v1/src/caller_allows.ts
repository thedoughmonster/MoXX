import type { CallerKey, CreateRequest } from "./types.ts"

const permissions: Record<CallerKey, [string, string][]> = {
  "communications-gateway": [
    ["communications.router", "auto"],
    ["communications.answer", "quick"],
    ["communications.answer", "standard"],
    ["communications.answer", "deep"],
    ["communications.answer", "maximum"],
  ],
  "communications-evaluation": [["communications.evaluation", "default"]],
}

export function callerAllows(caller: CallerKey, request: CreateRequest): boolean {
  return permissions[caller].some(([purpose, profile]) =>
    request.purpose_key === purpose && request.profile_key === profile)
}
