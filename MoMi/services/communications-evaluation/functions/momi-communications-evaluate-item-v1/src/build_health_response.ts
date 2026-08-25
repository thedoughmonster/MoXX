import { functionKey } from "./types.ts"

export function buildHealthResponse(configured: boolean): Response {
  return Response.json({
    ok: configured,
    function_key: functionKey,
    evaluation_job_id: "0",
    disposition: configured ? "healthy" : "misconfigured",
  }, { status: configured ? 200 : 503 })
}
