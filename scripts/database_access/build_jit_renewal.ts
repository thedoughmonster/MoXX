import type { JitAccessResponse, JitRenewal } from "./types.ts"

const renewalSeconds = 89 * 24 * 60 * 60

export function buildJitRenewal(
  current: JitAccessResponse,
  nowSeconds = Math.floor(Date.now() / 1000),
): JitRenewal {
  if (!current.user_id) {
    throw new Error("Supabase JIT access did not return a user id")
  }
  if (!current.user_roles.some((role) => role.role === "postgres")) {
    throw new Error("Supabase JIT access does not authorize the postgres role")
  }
  const expiresAt = nowSeconds + renewalSeconds
  const roles = current.user_roles.map((role) =>
    role.role === "postgres" ? { ...role, expires_at: expiresAt } : role
  )
  return {
    expires_at: expiresAt,
    payload: { user_id: current.user_id, roles },
  }
}
