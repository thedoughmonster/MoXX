import { executeWork } from "./execute_work.ts"
import { parseWorkTrigger } from "./parse_request.ts"
import { functionKey } from "./types.ts"

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return Response.json({ ok: true, function_key: functionKey })
  }
  if (request.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
      headers: { Allow: "GET, POST" },
    })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, function_key: functionKey,
      work_id: "unknown", error: "invalid_request" }, { status: 400 })
  }
  const input = parseWorkTrigger(body)
  if (!input) {
    return Response.json({ ok: false, function_key: functionKey,
      work_id: "unknown", error: "invalid_request" }, { status: 400 })
  }
  try {
    const result = await executeWork(input)
    return Response.json(result.body, { status: result.status })
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    console.error("Hydrated alert worker failed", {
      work_id: input.work_id,
      error_name: errorName,
    })
    return Response.json({ ok: false, function_key: functionKey,
      work_id: input.work_id, error: "worker_failed" }, { status: 500 })
  }
}
