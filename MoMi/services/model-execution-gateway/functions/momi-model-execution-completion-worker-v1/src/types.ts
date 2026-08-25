export type CompletionInput = {
  work_id: string
  capability_token: string
}

export type ClaimedCompletion = CompletionInput & {
  call_id: string
  caller_key: string
  provider_response_id: string
  event_type: string
  timeout_seconds: number
}
