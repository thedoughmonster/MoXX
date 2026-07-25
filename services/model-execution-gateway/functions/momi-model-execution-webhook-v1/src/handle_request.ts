import OpenAI from "openai"
import { processCompletion } from "../../momi-model-execution-completion-worker-v1/src/process_completion.ts"
import { acceptWebhook } from "./accept_webhook.ts"

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const supportedEvents = new Set([
  "response.completed", "response.failed", "response.incomplete", "response.cancelled",
])

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return Response.json({ ok: Boolean(Deno.env.get("OPENAI_WEBHOOK_SECRET")?.trim()),
      function_key: "momi.model_execution.openai_webhook.v1" })
  }
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 })
  const rawBody = await request.text()
  if (rawBody.length > 65_536) return new Response("request too large", { status: 413 })
  const secret = Deno.env.get("OPENAI_WEBHOOK_SECRET")?.trim()
  if (!secret) return new Response("webhook unavailable", { status: 503 })
  let value: unknown
  try {
    const client = new OpenAI({ webhookSecret: secret })
    value = client.webhooks.unwrap(rawBody, request.headers)
  } catch {
    return new Response("invalid signature", { status: 400 })
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return new Response("invalid event", { status: 400 })
  }
  const event = value as unknown as Record<string, unknown>
  const data = event.data
  const webhookId = request.headers.get("webhook-id")
  if (typeof event.id !== "string" || typeof event.type !== "string" ||
    !supportedEvents.has(event.type) || typeof event.created_at !== "number" ||
    !data || typeof data !== "object" || Array.isArray(data) ||
    typeof (data as Record<string, unknown>).id !== "string" ||
    !webhookId || webhookId.length > 240) {
    return new Response("unsupported event", { status: 400 })
  }
  const accepted = await acceptWebhook({ webhook_id: webhookId,
    event_id: event.id, event_type: event.type,
    provider_response_id: (data as Record<string, unknown>).id as string,
    provider_created_at: new Date(event.created_at * 1000).toISOString() })
  if (accepted.work) {
    EdgeRuntime.waitUntil(processCompletion(accepted.work).catch((error) => {
      console.error("background completion wake failed", accepted.work!.work_id,
        error instanceof Error ? error.message : "unknown")
    }))
  }
  return Response.json({ ok: true, disposition: accepted.disposition })
}
