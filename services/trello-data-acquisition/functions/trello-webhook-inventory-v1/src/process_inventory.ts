import { parseWorkRequest } from "./parse_work_request.ts"
import type { InventoryDependencies } from "./types.ts"

export async function processInventory(
  request: Request,
  dependencies: InventoryDependencies,
): Promise<Response> {
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 })
  let input: unknown
  try {
    input = await request.json()
  } catch {
    return new Response("invalid work", { status: 400 })
  }
  const work = parseWorkRequest(input)
  if (!work) return new Response("invalid work", { status: 400 })
  const apiKey = dependencies.getSetting("TRELLO_API_KEY")
  const apiToken = dependencies.getSetting("TRELLO_API_TOKEN")
  if (!apiKey || !apiToken) return new Response("service unavailable", { status: 503 })
  try {
    const job = await dependencies.claim(work)
    if (!job) return new Response("work unavailable", { status: 409 })
    const result = await dependencies.acquire(job, apiKey, apiToken)
    const status = await dependencies.finish(job, result)
    return Response.json({
      ok: true,
      status,
      source_response: {
        http_status: result.httpStatus,
        headers: result.headers,
        payload: result.payload,
        raw_text: result.rawText,
        error_code: result.errorCode,
      },
    })
  } catch (error) {
    console.error("Trello webhook inventory failed", {
      job_id: work.jobId,
      error_name: error instanceof Error ? error.name : "UnknownError",
    })
    return new Response("inventory failed", { status: 500 })
  }
}
