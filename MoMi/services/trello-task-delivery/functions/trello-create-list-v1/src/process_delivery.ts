import { parseWorkRequest } from "./parse_work_request.ts"
import type { DeliveryDependencies } from "./types.ts"

export async function processDelivery(
  request: Request,
  dependencies: DeliveryDependencies,
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
  const prefix = dependencies.getSetting("TRELLO_CLIENT_IDENTIFIER_PREFIX")
  const normalizedPrefix = prefix?.trim()
  if (!apiKey || !apiToken || !normalizedPrefix || normalizedPrefix.length > 950) {
    return new Response("service unavailable", { status: 503 })
  }
  const marker = `${normalizedPrefix}:${work.operationId}`
  try {
    const operation = await dependencies.claim(work)
    if (!operation) return new Response("work unavailable", { status: 409 })
    const result = await dependencies.deliver(operation, apiKey, apiToken, marker)
    const status = await dependencies.finish(operation, result, marker)
    return Response.json({ ok: true, status })
  } catch (error) {
    console.error("Trello list delivery failed", {
      operation_id: work.operationId,
      error_name: error instanceof Error ? error.name : "UnknownError",
    })
    return new Response("delivery failed", { status: 500 })
  }
}
