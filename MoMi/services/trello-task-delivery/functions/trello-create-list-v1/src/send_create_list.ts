import { parseJson } from "./parse_json.ts"
import { selectSafeHeaders } from "./select_safe_headers.ts"
import type { ClaimedOperation, DeliveryResult } from "./types.ts"

export async function sendCreateList(
  operation: ClaimedOperation,
  apiKey: string,
  apiToken: string,
  clientIdentifier: string,
  fetcher: typeof fetch = fetch,
): Promise<DeliveryResult> {
  try {
    const parameters = new URLSearchParams({
      name: operation.listName,
      idBoard: operation.boardId,
      pos: operation.listPosition,
    })
    const response = await fetcher(`https://api.trello.com/1/lists?${parameters}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        Accept: "application/json",
        Authorization: `OAuth oauth_consumer_key="${apiKey}", oauth_token="${apiToken}"`,
        "X-Trello-Client-Identifier": clientIdentifier,
      },
    })
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
