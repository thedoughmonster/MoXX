// service-owner: trello-evidence-ingestion

import { buildEvidenceEnvelope } from "./build_evidence_envelope.ts"
import { parseTrelloWebhook } from "./parse_trello_webhook.ts"
import type { IngestionDependencies } from "./types.ts"
import { verifyTrelloSignature } from "./verify_trello_signature.ts"

export async function processWebhook(
  request: Request,
  dependencies: IngestionDependencies,
): Promise<Response> {
  if (request.method === "HEAD") return new Response(null, { status: 200 })
  if (request.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
      headers: { Allow: "HEAD, POST" },
    })
  }

  const secret = dependencies.getSetting("TRELLO_WEBHOOK_SECRET")
  const callbackUrl = dependencies.getSetting("TRELLO_WEBHOOK_CALLBACK_URL")
  if (!secret || !callbackUrl) {
    return new Response("service unavailable", { status: 503 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get("x-trello-webhook")
  const authentic = signature
    ? await verifyTrelloSignature(rawBody, callbackUrl, signature, secret)
    : false
  if (!authentic) return new Response("invalid signature", { status: 401 })

  const payload = parseTrelloWebhook(rawBody)
  if (!payload) return new Response("invalid payload", { status: 400 })
  const markerHeader = request.headers.get("x-trello-client-identifier")
  const clientIdentifier = markerHeader?.trim().slice(0, 1000) || null
  const envelope = buildEvidenceEnvelope(payload, rawBody, clientIdentifier)

  try {
    const receipt = await dependencies.store(envelope)
    return Response.json({ ok: true, disposition: receipt.disposition })
  } catch (error) {
    console.error("Trello webhook evidence capture failed", {
      action_id: envelope.actionId,
      error_name: error instanceof Error ? error.name : "UnknownError",
    })
    return new Response("persistence failed", { status: 500 })
  }
}
