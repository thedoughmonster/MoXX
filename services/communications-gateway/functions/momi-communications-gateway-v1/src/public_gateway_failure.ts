export function publicGatewayFailure(error: unknown): {
  status: number
  body: { error: string }
} {
  const value = error && typeof error === "object"
    ? error as { code?: unknown; message?: unknown }
    : {}
  const code = typeof value.code === "string" ? value.code : ""
  const message = typeof value.message === "string" ? value.message : ""
  if (code === "22023" && message === "effective rate or budget limit refused request") {
    return { status: 429, body: { error: "request_limit_reached" } }
  }
  if (code === "22023" && message === "effective user limit refused request") {
    return { status: 413, body: { error: "input_limit_reached" } }
  }
  return { status: 503, body: { error: "gateway_failed_closed" } }
}
