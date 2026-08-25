import type { TokenConfig, TokenResult } from "./runtime_types.ts";
import { toastTokenCache } from "./token_cache.ts";

export async function getToastToken(
  config: TokenConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenResult> {
  const base = new URL(config.api_base_url);
  if (
    base.protocol !== "https:" || base.username || base.password ||
    base.search || base.hash
  ) {
    return { ok: false, status: null, error: "invalid source configuration" };
  }
  const cacheKey = [
    config.api_base_url,
    config.client_id,
    config.user_access_type,
  ].join("|");
  if (
    toastTokenCache.key === cacheKey && Date.now() < toastTokenCache.expires_at
  ) {
    return {
      ok: true,
      token_type: toastTokenCache.token_type,
      access_token: toastTokenCache.access_token,
    };
  }
  const authPath = ["authentication", "v1", "authentication", "login"].join(
    "/",
  );
  const basePath = base.pathname === "/"
    ? ""
    : base.pathname.replace(/\/+$/, "");
  base.pathname = `${basePath}/${authPath}`;
  let response: Response;
  try {
    response = await fetchImpl(base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: config.client_id,
        clientSecret: config.client_secret,
        userAccessType: config.user_access_type,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(config.request_timeout_ms),
    });
  } catch {
    return { ok: false, status: null, error: "authentication network error" };
  }
  let body: unknown;
  try {
    body = JSON.parse(await response.text());
  } catch {
    return {
      ok: false,
      status: response.status,
      error: "invalid authentication response",
    };
  }
  if (!response.ok || typeof body !== "object" || body === null) {
    return {
      ok: false,
      status: response.status,
      error: "authentication rejected",
    };
  }
  const token = (body as Record<string, unknown>).token;
  if (typeof token !== "object" || token === null) {
    return {
      ok: false,
      status: response.status,
      error: "invalid authentication response",
    };
  }
  const value = token as Record<string, unknown>;
  if (
    typeof value.tokenType !== "string" ||
    typeof value.accessToken !== "string" ||
    typeof value.expiresIn !== "number" || value.expiresIn <= 0
  ) {
    return {
      ok: false,
      status: response.status,
      error: "invalid authentication response",
    };
  }
  toastTokenCache.key = cacheKey;
  toastTokenCache.token_type = value.tokenType;
  toastTokenCache.access_token = value.accessToken;
  toastTokenCache.expires_at = Date.now() +
    Math.max(0, value.expiresIn * 1000 - 60000);
  return {
    ok: true,
    token_type: value.tokenType,
    access_token: value.accessToken,
  };
}
