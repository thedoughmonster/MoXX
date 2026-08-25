import { parseResponseBody } from "./parse_response_body.ts";
import type { RegisteredRequest } from "./registry_types.ts";
import type { SourcePage } from "./runtime_types.ts";
import { selectSafeHeaders } from "./select_safe_headers.ts";

export async function fetchSourcePage(
  request: RegisteredRequest,
  timeoutMs: number,
  tokenType: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SourcePage> {
  const headers = new Headers(request.headers);
  headers.set("authorization", `${tokenType} ${accessToken}`);
  const response = await fetchImpl(request.url, {
    method: "GET",
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const rawBody = await response.text();
  return {
    status: response.status,
    raw_body: rawBody,
    parsed_body: parseResponseBody(rawBody),
    response_headers: selectSafeHeaders(response.headers),
    retrieved_at: new Date().toISOString(),
  };
}
