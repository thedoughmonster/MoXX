import { governorDependencies } from "./dependencies.ts";
import { isConfigured } from "./is_configured.ts";
import { parseTickInput } from "./parse_tick_input.ts";
import { processTick } from "./process_tick.ts";
import { functionKey } from "./types.ts";

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { Allow: "GET, POST, OPTIONS" },
    });
  }
  if (request.method === "GET") {
    const configured = isConfigured();
    return Response.json({
      ok: configured,
      function_key: functionKey,
      tick_id: "00000000-0000-4000-8000-000000000000",
      disposition: configured ? "configured" : "not_configured",
      phase: null,
      receipt: null,
    }, { status: configured ? 200 : 503 });
  }
  if (request.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
      headers: { Allow: "GET, POST, OPTIONS" },
    });
  }
  const body: unknown = await request.json().catch(() => null);
  const input = parseTickInput(body);
  if (!input) {
    return Response.json({
      ok: false,
      function_key: functionKey,
      tick_id: "00000000-0000-4000-8000-000000000000",
      disposition: "invalid_request",
      phase: null,
      receipt: null,
    }, { status: 400 });
  }
  try {
    const result = await processTick(input, governorDependencies);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    const code = error instanceof Error ? error.name : "unknown";
    console.error("Cron history governor failed", input.tick_id, code);
    return Response.json({
      ok: false,
      function_key: functionKey,
      tick_id: input.tick_id,
      disposition: "governor_failed",
      phase: null,
      receipt: null,
    }, { status: 503 });
  }
}
