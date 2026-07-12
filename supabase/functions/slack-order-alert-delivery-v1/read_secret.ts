export function readConfiguredSecret(name: string): string | null {
  const value = Deno.env.get(name)?.trim()
  return value ? value : null
}
