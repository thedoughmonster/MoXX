type SupabaseProject = { id?: unknown; ref?: unknown }

export function assertSupabaseProjectAccess(
  output: string,
  projectRef: string,
): void {
  let projects: unknown
  try {
    projects = JSON.parse(output)
  } catch {
    throw new Error("Supabase CLI project list was not valid JSON")
  }
  if (!Array.isArray(projects)) {
    throw new Error("Supabase CLI project list was not an array")
  }
  const visible = projects.some((value: SupabaseProject) =>
    value?.id === projectRef || value?.ref === projectRef
  )
  if (!visible) {
    throw new Error(`Supabase CLI cannot access target project ${projectRef}`)
  }
}
