import { parseSlackBody } from "./parse_slack_body.ts"
import { selectSafeSlackHeaders } from "./select_safe_slack_headers.ts"
import type {
  SlackMessagePayload,
  SlackTransportResult,
} from "./types.ts"

const slackPostMessageUrl = "https://slack.com/api/chat.postMessage"
const slackRequestTimeoutMs = 30_000

export async function sendSlackMessage(
  messagePayload: SlackMessagePayload,
  botToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SlackTransportResult> {
  const response = await fetchImpl(slackPostMessageUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messagePayload),
    signal: AbortSignal.timeout(slackRequestTimeoutMs),
  })
  const parsed = parseSlackBody(await response.text())

  return {
    status: response.status,
    response_headers: selectSafeSlackHeaders(response.headers),
    ...parsed,
  }
}
