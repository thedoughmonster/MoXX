export function isServiceRoleAuthorization(
  authorization: string | null,
  serviceRoleKey: string | undefined,
): boolean {
  return Boolean(
    serviceRoleKey && authorization === `Bearer ${serviceRoleKey}`,
  )
}
