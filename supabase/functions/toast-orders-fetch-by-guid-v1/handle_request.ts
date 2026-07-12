import { isInternalKeyAuthorization } from "./authorize_request.ts"
import { executeJob } from "./execute_job.ts"
import { parseJobId } from "./parse_request.ts"
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

  const isAuthorized = isInternalKeyAuthorization(
    request.headers.get("x-momi-internal-key"),
    Deno.env.get("MOMI_INTERNAL_FUNCTION_KEY"),
  )
  if (!isAuthorized) {
    return new Response("forbidden", { status: 403 })
  }

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return new Response("invalid request", { status: 400 })
  }

  const jobId = parseJobId(input)
  if (!jobId) {
    return new Response("invalid request", { status: 400 })
  }

  const codeCommitSha = Deno.env.get("MOMI_CODE_COMMIT_SHA")?.trim()
  if (!codeCommitSha) {
    return new Response("service unavailable", { status: 503 })
  }

  try {
    const result = await executeJob(
      jobId,
      codeCommitSha,
      Deno.env.get("DENO_DEPLOYMENT_ID") ?? null,
    )
    return Response.json(result.body, { status: result.status })
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    console.error("Toast order hydration failed", {
      job_id: jobId,
      error_name: errorName,
    })
    return new Response("persistence failed", { status: 500 })
  }
}
