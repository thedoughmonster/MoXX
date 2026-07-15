export function parseFunctionVerifyJwt(source: string): Map<string, boolean> {
  const settings = new Map<string, boolean>()
  let functionSlug: string | null = null

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, "").trim()
    const section = line.match(/^\[functions\.([a-z][a-z0-9-]+)\]$/)
    if (section) {
      functionSlug = section[1]
      continue
    }
    if (line.startsWith("[")) {
      functionSlug = null
      continue
    }
    const setting = line.match(/^verify_jwt\s*=\s*(true|false)$/)
    if (functionSlug && setting) {
      settings.set(functionSlug, setting[1] === "true")
    }
  }

  return settings
}
