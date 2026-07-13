import { executeJob } from "./execute_job.ts"
import { parseHydrationTrigger } from "./parse_request.ts"
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

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return new Response("invalid request", { status: 400 })
  }

  const trigger = parseHydrationTrigger(input)
  if (!trigger) {
    return new Response("invalid request", { status: 400 })
  }

  const codeCommitSha = Deno.env.get("MOMI_CODE_COMMIT_SHA")?.trim()
  if (!codeCommitSha) {
    return new Response("service unavailable", { status: 503 })
  }

  try {
    const result = await executeJob(
      trigger.job_id,
      trigger.trigger_token,
      codeCommitSha,
      Deno.env.get("DENO_DEPLOYMENT_ID") ?? null,
    )
    return Response.json(result.body, { status: result.status })
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    console.error("Toast order hydration failed", {
      job_id: trigger.job_id,
      error_name: errorName,
    })
    return new Response("persistence failed", { status: 500 })
  }
}
