import { parseSourceBody } from "./parse_source_body.ts"
import type { ToastAuthConfig, ToastAuthResult } from "./types.ts"

let cachedKey = ""
let cachedTokenType = ""
let cachedAccessToken = ""
let cachedExpiresAt = 0

export async function getToastToken(
  config: ToastAuthConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ToastAuthResult> {
  const cacheKey = `${config.api_base_url}|${config.client_id}`
  if (cacheKey === cachedKey && Date.now() < cachedExpiresAt) {
    return {
      ok: true,
      status: 200,
      token_type: cachedTokenType,
      access_token: cachedAccessToken,
      body: null,
    }
  }

  const url = new URL(
    "/authentication/v1/authentication/login",
    `${config.api_base_url.replace(/\/+$/, "")}/`,
  )
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: config.client_id,
      clientSecret: config.client_secret,
      userAccessType: config.user_access_type,
    }),
    signal: AbortSignal.timeout(config.request_timeout_ms),
  })
  const body = parseSourceBody(await response.text())

  if (!response.ok || typeof body !== "object" || body === null) {
    return { ok: false, status: response.status, body }
  }

  const token = (body as Record<string, unknown>).token
  if (typeof token !== "object" || token === null) {
    return { ok: false, status: response.status, body: null }
  }

  const tokenRecord = token as Record<string, unknown>
  const tokenType = tokenRecord.tokenType
  const accessToken = tokenRecord.accessToken
  const expiresIn = tokenRecord.expiresIn
  if (
    typeof tokenType !== "string" || typeof accessToken !== "string" ||
    typeof expiresIn !== "number" || !Number.isFinite(expiresIn)
  ) {
    return { ok: false, status: response.status, body: null }
  }

  cachedKey = cacheKey
  cachedTokenType = tokenType
  cachedAccessToken = accessToken
  cachedExpiresAt = Date.now() + Math.max(1000, expiresIn * 1000 - 60000)

  return {
    ok: true,
    status: response.status,
    token_type: tokenType,
    access_token: accessToken,
    body: null,
  }
}
