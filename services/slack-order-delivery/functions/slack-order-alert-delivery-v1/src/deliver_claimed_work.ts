import { failedDeliveryResult } from "./failed_delivery_result.ts"
import { isSlackSuccess } from "./is_slack_success.ts"
import { loadPreparedMessage } from "./load_prepared_message.ts"
import { readConfiguredSecret } from "./read_secret.ts"
import { recordFailure } from "./record_failure.ts"
import { recordSuccess } from "./record_success.ts"
import { sendSlackMessage } from "./send_slack_message.ts"
import { summarizeSlackResponse } from "./summarize_slack_response.ts"
import type {
  ClaimedWork,
  ExecutionResult,
  SlackTransportResult,
} from "./types.ts"

export async function deliverClaimedWork(
  work: ClaimedWork,
): Promise<ExecutionResult> {
  const message = await loadPreparedMessage(work.work_id)
  if (!message || message.candidate_id !== work.candidate_id) {
    await recordFailure(work, {
      http_status: null, channel: null, ts: null,
      response_metadata: {},
      error_code: "prepared_message_not_found",
      error_message: "Prepared Slack message is unavailable",
    })
    return failedDeliveryResult(work, 409, "message unavailable")
  }

  if (!message.destination_enabled) {
    await recordFailure(work, {
      http_status: null, channel: message.slack_channel_id, ts: null,
      response_metadata: {},
      error_code: "slack_destination_disabled",
      error_message: "Slack destination is disabled",
    })
    return failedDeliveryResult(work, 409, "destination disabled")
  }

  const botToken = readConfiguredSecret("SLACK_BOT_TOKEN")
  if (!botToken) {
    await recordFailure(work, {
      http_status: null, channel: message.slack_channel_id, ts: null,
      response_metadata: {},
      error_code: "slack_bot_token_unavailable",
      error_message: "Slack credentials are unavailable",
    })
    return failedDeliveryResult(work, 503, "destination unavailable")
  }

  let response: SlackTransportResult
  try {
    response = await sendSlackMessage(message.message_payload, botToken)
  } catch {
    await recordFailure(work, {
      http_status: null, channel: message.slack_channel_id, ts: null,
      response_metadata: {},
      error_code: "slack_network_error",
      error_message: "Slack request failed",
    })
    return failedDeliveryResult(work, 502, "destination unavailable")
  }

  const summary = summarizeSlackResponse(response)
  if (!isSlackSuccess(response)) {
    const errorCode = response.status !== 200
      ? "slack_http_error"
      : response.is_json ? "slack_api_error" : "slack_invalid_response"
    await recordFailure(work, {
      channel: summary.channel,
      ts: summary.ts,
      response_metadata: summary.response_metadata,
      http_status: response.status,
      error_code: errorCode,
      error_message: summary.slack_error ?? "Slack rejected the message",
    })
    return failedDeliveryResult(work, 502, "delivery failed")
  }

  await recordSuccess(work, response, summary)
  return {
    status: 200,
    body: {
      ok: true,
      disposition: "sent",
      work_id: work.work_id,
      attempt_id: work.attempt_id,
      invocation_id: work.invocation_id,
      ...(summary.channel ? { channel: summary.channel } : {}),
      ...(summary.ts ? { ts: summary.ts } : {}),
    },
  }
}
