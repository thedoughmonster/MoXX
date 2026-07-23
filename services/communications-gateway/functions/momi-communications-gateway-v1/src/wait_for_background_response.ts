import type { JSONValue } from "postgres"
import { retrieveProviderResponse } from "./retrieve_provider_response.ts"
import type { ProviderResult } from "./types.ts"

export type BackgroundProviderResult = {
  result: ProviderResult
  observations: JSONValue[]
}

const pending = new Set(["queued", "in_progress"])

export async function waitForBackgroundResponse(
  endpoint: string,
  initial: ProviderResult,
  deadline: string,
  fetchImpl: typeof fetch = fetch,
  pollDelayMilliseconds = 1000,
): Promise<BackgroundProviderResult> {
  let result = initial
  let duration = initial.duration_ms
  const observations: JSONValue[] = [{
    phase: "create",
    http_status: initial.status,
    provider_status: typeof initial.body.status === "string"
      ? initial.body.status
      : null,
    response: initial.body,
  }]
  while (result.ok && !result.ambiguous &&
    typeof result.body.status === "string" &&
    pending.has(result.body.status)) {
    const responseId = result.body.id
    const remaining = Date.parse(deadline) - Date.now()
    if (typeof responseId !== "string" || responseId.length < 1) {
      result = { ok: false, ambiguous: false, status: 0,
        body: { error: { type: "provider_background_id_missing" } },
        duration_ms: duration }
      break
    }
    if (!Number.isFinite(remaining) || remaining <= pollDelayMilliseconds) {
      result = { ok: false, ambiguous: false, status: 0,
        body: { error: { type: "provider_background_deadline_exceeded" } },
        duration_ms: duration }
      break
    }
    if (pollDelayMilliseconds > 0) {
      await new Promise((resolve) => setTimeout(resolve, pollDelayMilliseconds))
    }
    const timeout = Math.max(1, Math.min(10,
      Math.floor((Date.parse(deadline) - Date.now()) / 1000)))
    const retrieved = await retrieveProviderResponse(
      endpoint,
      responseId,
      timeout,
      fetchImpl,
    )
    duration += retrieved.duration_ms
    observations.push({
      phase: "poll",
      http_status: retrieved.status,
      provider_status: typeof retrieved.body.status === "string"
        ? retrieved.body.status
        : null,
      ...(!retrieved.ok || typeof retrieved.body.status !== "string" ||
          !pending.has(retrieved.body.status)
        ? { response: retrieved.body }
        : {}),
    })
    result = { ...retrieved, duration_ms: duration }
  }
  return { result, observations }
}
