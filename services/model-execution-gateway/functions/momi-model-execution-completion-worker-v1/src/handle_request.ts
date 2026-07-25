import { parseCompletionInput } from "./parse_request.ts"
import { processCompletion } from "./process_completion.ts"

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return Response.json({ ok: true,
      function_key: "momi.model_execution.complete_background.v1" })
  }
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: { Allow: "GET, POST" } })
  }
  const input = parseCompletionInput(await request.json().catch(() => null))
  if (!input) return new Response("invalid request", { status: 400 })
  try {
    const disposition = await processCompletion(input)
    return Response.json({ ok: true, disposition })
  } catch (error) {
    console.error("model completion worker failed", input.work_id,
      error instanceof Error ? error.message : "unknown")
    return Response.json({ ok: false, disposition: "retrying" }, { status: 503 })
  }
}
