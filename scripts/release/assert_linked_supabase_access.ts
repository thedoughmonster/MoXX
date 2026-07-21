export function assertLinkedSupabaseAccess(output: string): void {
  let result: unknown
  try {
    result = JSON.parse(output)
  } catch {
    throw new Error("Linked Supabase access proof was not valid JSON")
  }
  const rows = typeof result === "object" && result !== null
    ? (result as { rows?: unknown }).rows
    : undefined
  if (
    !Array.isArray(rows) || rows.length !== 1 ||
    (rows[0] as { release_access_check?: unknown })?.release_access_check !== 1
  ) {
    throw new Error("Linked Supabase access proof returned an unexpected result")
  }
}
