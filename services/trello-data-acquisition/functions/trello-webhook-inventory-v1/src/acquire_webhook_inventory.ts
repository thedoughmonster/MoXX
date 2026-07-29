import { parseJson } from "./parse_json.ts"
import { selectSafeHeaders } from "./select_safe_headers.ts"
import type { ClaimedJob, SourceResult } from "./types.ts"

export async function acquireWebhookInventory(
  _job: ClaimedJob,
  apiKey: string,
  apiToken: string,
  fetcher: typeof fetch = fetch,
): Promise<SourceResult> {
  const token = encodeURIComponent(apiToken)
  try {
    const response = await fetcher(
      `https://api.trello.com/1/tokens/${token}/webhooks`,
      {
        method: "GET",
        redirect: "manual",
        headers: {
          Accept: "application/json",
          Authorization: `OAuth oauth_consumer_key="${apiKey}", oauth_token="${apiToken}"`,
        },
      },
    )
    const rawText = await response.text()
    return {
      httpStatus: response.status,
      headers: selectSafeHeaders(response.headers),
      payload: parseJson(rawText),
      rawText,
      errorCode: response.ok ? null : "trello_http_error",
    }
  } catch {
    return {
      httpStatus: null,
      headers: {},
      payload: null,
      rawText: null,
      errorCode: "trello_network_error",
    }
  }
}
