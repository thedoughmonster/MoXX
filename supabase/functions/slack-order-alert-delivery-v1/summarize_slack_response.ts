import type {
  SlackResponseSummary,
  SlackTransportResult,
} from "./types.ts"

export function summarizeSlackResponse(
  response: SlackTransportResult,
): SlackResponseSummary {
  const body = typeof response.body === "object" && response.body !== null &&
      !Array.isArray(response.body)
    ? response.body as Record<string, unknown>
    : {}
  const slackMetadata = typeof body.response_metadata === "object" &&
      body.response_metadata !== null && !Array.isArray(body.response_metadata)
    ? body.response_metadata as Record<string, unknown>
    : {}

  return {
    channel: typeof body.channel === "string" ? body.channel : null,
    ts: typeof body.ts === "string" ? body.ts : null,
    slack_error: typeof body.error === "string" ? body.error : null,
    response_metadata: {
      response_headers: response.response_headers,
      slack_response_metadata: slackMetadata,
      response_json_valid: response.is_json,
    },
  }
}
