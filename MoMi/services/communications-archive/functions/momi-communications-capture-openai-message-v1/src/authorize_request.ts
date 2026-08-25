export function isAuthorizedRequest(request: Request): boolean {
  const authorization = request.headers.get("authorization")
  if (!authorization?.startsWith("Bearer ")) {
    return false
  }
  const encodedPayload = authorization.slice(7).split(".")[1]
  if (!encodedPayload) {
    return false
  }
  try {
    const normalized = encodedPayload.replaceAll("-", "+").replaceAll("_", "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    const claims = JSON.parse(atob(padded)) as { role?: unknown }
    return claims.role === "authenticated" || claims.role === "service_role"
  } catch {
    return false
  }
}
