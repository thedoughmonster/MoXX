// service-owner: toast-order-ingest

import { parseToastPayload } from "./parse_toast_payload.ts"
import { storeRawOrderEvent } from "./store_raw_order_event.ts"
import { verifyToastSignature } from "./verify_toast_signature.ts"

export async function handleRequest(request: Request): Promise<Response> {
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
  const payload = parseToastPayload(rawBody)

  if (!payload) {
    return new Response("invalid payload", { status: 400 })
  }

  const secret = Deno.env.get("TOAST_ORDERS_WEBHOOK_SECRET")

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
    const disposition = await storeRawOrderEvent(
      payload,
      rawBody,
    )

    return Response.json({ ok: true, disposition })
  } catch (error) {
    console.error("Toast webhook persistence failed", error)
    return new Response("persistence failed", { status: 500 })
  }
}
