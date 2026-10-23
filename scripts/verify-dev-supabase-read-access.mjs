import { pathToFileURL } from "node:url"
import { assertSupabasePreflightAuthority } from "./assert-supabase-preflight-authority.mjs"

export async function verifyDevSupabaseReadAccess(token, runtime = {}) {
  if (!/^sbp_[A-Za-z0-9_-]+$/.test(token ?? "")) {
    throw new Error("SUPABASE_ACCESS_TOKEN is missing or malformed")
  }
  const request = runtime.fetch ?? fetch
  const report = runtime.log ?? console.log
  const controller = new AbortController()
  const deadline = setTimeout(() => controller.abort(), 5000)
  let reader
  try {
    let response
    try {
      response = await request(
        "https://api.supabase.com/v1/projects/xtbraqnlskmqxinjxxdn/health?services=auth&timeout_ms=2000",
        { headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: controller.signal },
      )
    } catch {
      throw new Error("Supabase dev health request failed")
    }
    report(JSON.stringify({ endpoint: "dev_service_health", http_status: response.status }))
    if (response.status !== 200) {
      throw new Error(`Supabase dev health read rejected with HTTP ${response.status}`)
    }
    let payload
    try {
      reader = response.body.getReader()
      const decoder = new TextDecoder("utf-8", { fatal: true })
      let bytes = 0
      let body = ""
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > 16384) throw new Error("size limit")
        body += decoder.decode(chunk.value, { stream: true })
      }
      payload = JSON.parse(body + decoder.decode())
    } catch {
      throw new Error("Supabase dev health response is unreadable or exceeds its limit")
    }
    const service = Array.isArray(payload) && payload.length === 1 ? payload[0] : null
    if (!service || typeof service !== "object" || Array.isArray(service) ||
      service.name !== "auth" || typeof service.healthy !== "boolean" ||
      typeof service.status !== "string" || service.status.length === 0) {
      throw new Error("Supabase dev health response does not match the requested service")
    }
    report(JSON.stringify({
      endpoint: "dev_service_health", http_status: 200, authenticated: true,
      target_read_access_verified: true, target_ref_bound: true,
      service_healthy: service.healthy, write_authority_tested: false,
    }))
  } finally {
    clearTimeout(deadline)
    controller.abort()
    if (reader) {
      try { void reader.cancel().catch(() => {}) } catch { /* Suppress cancellation errors. */ }
    }
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  assertSupabasePreflightAuthority(process.env)
  if (process.env.MOXX_TARGET_ENVIRONMENT !== "dev") {
    throw new Error("Development health preflight requires the dev environment")
  }
  await verifyDevSupabaseReadAccess(process.env.SUPABASE_ACCESS_TOKEN)
}
