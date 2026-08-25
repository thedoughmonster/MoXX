export const rawText = JSON.stringify({
  event_id: "square-event",
  type: "payment.updated",
  private: "raw-provider",
})

export function request(body = rawText): Request {
  return new Request("https://example.test/functions/v1/webhook", {
    method: "POST", headers: { "x-square-hmacsha256-signature": "signature" },
    body,
  })
}
