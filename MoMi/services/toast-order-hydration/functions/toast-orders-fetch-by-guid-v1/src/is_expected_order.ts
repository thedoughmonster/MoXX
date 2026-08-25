export function isExpectedOrder(body: unknown, orderGuid: string): boolean {
  return typeof body === "object" && body !== null && !Array.isArray(body) &&
    (body as Record<string, unknown>).guid === orderGuid
}
