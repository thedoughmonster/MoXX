export function parseFunctionVerifyJwt(source: string): Map<string, boolean> {
  const settings = new Map<string, boolean>()
  const explicitSettings = new Set<string>()
  let functionSlug: string | null = null

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, "").trim()
    if (
      /(?:^|\[\s*|\.\s*)"[^"]*\\(?:u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})[^"]*"\s*(?:\.|=|\])/.test(line)
    ) throw new Error(`unsupported escaped TOML key: ${line}`)
    if (
      /^\[{1,2}\s*(?:functions|"functions"|'functions')(?:\s*\.|\s*\])/.test(line)
    ) {
      const section = line.match(/^\[functions\.([a-z][a-z0-9-]+)\]$/)
      if (!section) throw new Error(`unsupported function section: ${line}`)
      functionSlug = section[1]
      if (settings.has(functionSlug)) {
        throw new Error(`duplicate function section: ${functionSlug}`)
      }
      settings.set(functionSlug, true)
      continue
    }
    if (/^(?:functions|"functions"|'functions')\s*(?:\.|=)/.test(line)) {
      throw new Error(`unsupported function declaration: ${line}`)
    }
    if (line.startsWith("[")) {
      functionSlug = null
      continue
    }
    if (
      !functionSlug ||
      !/^(?:verify_jwt|"verify_jwt"|'verify_jwt')\s*(?:\.|=)/.test(line)
    ) continue
    const setting = line.match(/^verify_jwt\s*=\s*(true|false)$/)
    if (!setting) throw new Error(`${functionSlug}: invalid verify_jwt setting`)
    if (explicitSettings.has(functionSlug)) {
      throw new Error(`${functionSlug}: duplicate verify_jwt setting`)
    }
    explicitSettings.add(functionSlug)
    settings.set(functionSlug, setting[1] === "true")
  }

  return settings
}
