import { parseJson } from "./parse_json.ts"
import { selectSafeHeaders } from "./select_safe_headers.ts"
import type { ClaimedOperation, DeliveryResult } from "./types.ts"

export async function sendRegisterWebhook(
  operation: ClaimedOperation,
  apiKey: string,
  apiToken: string,
  clientIdentifier: string,
  fetcher: typeof fetch = fetch,
): Promise<DeliveryResult> {
  try {
    const response = await fetcher("https://api.trello.com/1/webhooks", {
      method: "POST",
      redirect: "manual",
      headers: {
        Accept: "application/json",
        Authorization: `OAuth oauth_consumer_key="${apiKey}", oauth_token="${apiToken}"`,
        "Content-Type": "application/json",
        "X-Trello-Client-Identifier": clientIdentifier,
      },
      body: JSON.stringify({
        active: true,
        callbackURL: operation.callbackUrl,
        description: operation.description,
        idModel: operation.boardId,
      }),
    })
    const rawText = await response.text()
    const payload = parseJson(rawText)
    const valid = response.ok && payload !== null && !Array.isArray(payload)
      && typeof payload === "object" && typeof payload.id === "string"
      && payload.id.length > 0 && payload.idModel === operation.boardId
      && payload.callbackURL === operation.callbackUrl && payload.active === true
    return {
      finalStatus: valid ? "succeeded" : response.status >= 500 || response.ok
        ? "ambiguous"
        : "failed",
      httpStatus: response.status,
      headers: selectSafeHeaders(response.headers),
      payload,
      rawText,
      errorCode: valid ? null : response.ok
        ? "trello_response_invalid"
        : "trello_http_error",
    }
  } catch {
    return {
      finalStatus: "ambiguous",
      httpStatus: null,
      headers: {},
      payload: null,
      rawText: null,
      errorCode: "trello_network_error",
    }
  }
}
