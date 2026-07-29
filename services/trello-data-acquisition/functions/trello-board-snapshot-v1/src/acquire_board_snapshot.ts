import { parseJson } from "./parse_json.ts"
import { selectSafeHeaders } from "./select_safe_headers.ts"
import type { ClaimedJob, SourceResult } from "./types.ts"

export async function acquireBoardSnapshot(
  job: ClaimedJob,
  apiKey: string,
  apiToken: string,
  fetcher: typeof fetch = fetch,
): Promise<SourceResult> {
  const board = encodeURIComponent(job.boardLocator)
  const query = "fields=id,name,closed,url,shortLink&lists=open&list_fields=id,name,pos,closed&cards=open&card_fields=id,name,idList,closed"
  try {
    const response = await fetcher(`https://api.trello.com/1/boards/${board}?${query}`, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "application/json",
        Authorization: `OAuth oauth_consumer_key="${apiKey}", oauth_token="${apiToken}"`,
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
