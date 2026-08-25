// service-owner: toast-webhook-ingestion

import { handlerVersion } from "./constants.ts"
import { deriveRestaurantGuid } from "./derive_restaurant_guid.ts"
import { hashRawBody } from "./hash_raw_body.ts"
import { matchWebhookContract } from "./match_webhook_contract.ts"
import { parseToastWebhook } from "./parse_toast_webhook.ts"
import type { IngestionDependencies } from "./types.ts"
import { verifyToastSignature } from "./verify_toast_signature.ts"

export async function processWebhook(
  request: Request,
  dependencies: IngestionDependencies,
): Promise<Response> {
  if (request.method === "GET") {
    return Response.json({ ok: true })
  }
  if (request.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
      headers: { Allow: "GET, POST" },
    })
  }

  const rawBody = await request.text()
  const payload = parseToastWebhook(rawBody)
  if (!payload) {
    return new Response("invalid payload", { status: 400 })
  }

  const contract = matchWebhookContract(payload.eventCategory, payload.eventType)
  if (!contract) {
    return new Response("invalid payload", { status: 400 })
  }

  const secret = dependencies.getSecret(contract.secretName)
  if (!secret) {
    return new Response("service unavailable", { status: 503 })
  }

  const signature = request.headers.get("toast-signature")
  const isAuthentic = signature
    ? await verifyToastSignature(rawBody, payload.timestamp, signature, secret)
    : false
  if (!isAuthentic) {
    return new Response("invalid signature", { status: 401 })
  }

  try {
    const disposition = await dependencies.store({
      eventGuid: payload.guid,
      subscriptionKey: contract.subscriptionKey,
      eventCategory: payload.eventCategory,
      eventType: payload.eventType,
      restaurantGuid: deriveRestaurantGuid(payload),
      correlationId: dependencies.createCorrelationId(),
      sourceOccurredAt: payload.timestamp,
      payload,
      rawBody,
      contentHash: await hashRawBody(rawBody),
      handlerVersion,
    })
    return Response.json({ ok: true, disposition })
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    console.error("Toast webhook persistence failed", {
      event_guid: payload.guid,
      error_name: errorName,
    })
    return new Response("persistence failed", { status: 500 })
  }
}
