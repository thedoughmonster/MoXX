export function isAdminAuthorized(request: Request): boolean {
  const expected = Deno.env.get("MOMI_GATEWAY_ADMIN_SECRET")
  const supplied = request.headers.get("authorization")
  if (!expected || !supplied?.startsWith("Bearer ")) return false
  const actual = supplied.slice(7)
  if (actual.length !== expected.length || actual.length === 0) return false
  let difference = 0
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index)
  }
  return difference === 0
}
