import { authenticateCaller } from "./authenticate_caller.ts"
import { callerAllows } from "./caller_allows.ts"
import { executeCreate } from "./execute_create.ts"
import { executeRetrieve } from "./execute_retrieve.ts"
import { parseRequest } from "./parse_request.ts"

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "GET") {
    const configured = Boolean(Deno.env.get("SUPABASE_DB_URL")?.trim() &&
      Deno.env.get("OPENAI_API_KEY")?.trim())
    return Response.json({ ok: configured,
      function_key: "momi.model_execution.execute.v1" },
      { status: configured ? 200 : 503 })
  }
  if (request.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 })
  }
  const caller = await authenticateCaller(request.headers.get("authorization"))
  if (!caller) return Response.json({ error: "unauthorized" }, { status: 401 })
  const declaredLength = Number(request.headers.get("content-length") ?? "0")
  if (declaredLength > 524288) {
    return Response.json({ error: "request too large" }, { status: 413 })
  }
  let value: unknown
  try { value = JSON.parse(await request.text()) } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 })
  }
  const input = parseRequest(value)
  if (!input) return Response.json({ error: "invalid request" }, { status: 400 })
  try {
    if (input.operation === "create") {
      if (!callerAllows(caller, input)) {
        return Response.json({ error: "caller purpose denied" }, { status: 403 })
      }
      return await executeCreate(caller, input)
    }
    return await executeRetrieve(caller, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : "model execution failed"
    console.error("model execution failed", caller, input.operation, message)
    return Response.json({ error: "model execution failed" }, { status: 503 })
  }
}
