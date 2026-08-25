import { functionKey } from "./constants.ts";
import { executeJob } from "./execute_job.ts";
import { parseAcquisitionInput } from "./parse_request.ts";
import { runBackgroundBatch } from "./run_background_batch.ts";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

export async function handleRequest(request: Request): Promise<Response> {
  const invocationStartedAtMs = Date.now();
  if (request.method === "GET") {
    return Response.json({ ok: true, function_key: functionKey });
  }
  if (request.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
      headers: { allow: "GET, POST" },
    });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("invalid request", { status: 400 });
  }
  const input = parseAcquisitionInput(body);
  if (!input) return new Response("invalid request", { status: 400 });
  try {
    const result = await executeJob(
      input.job_id,
      input.capability_token,
      invocationStartedAtMs,
    );
    if (result.continuation) {
      EdgeRuntime.waitUntil(runBackgroundBatch(result.continuation));
    }
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Toast data acquisition persistence failed", {
      job_id: input.job_id,
      error_name: error instanceof Error ? error.name : "UnknownError",
    });
    return new Response("persistence failed", { status: 500 });
  }
}
