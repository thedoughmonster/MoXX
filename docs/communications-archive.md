# Communications Archive

## Purpose

`momi_communications` is a private, channel-neutral archive for source
communications. ChatGPT/OpenAI messages are the first source contract, but the
core tables store common source account, source user, conversation, message,
sender, timestamp, payload, metadata, provenance, and idempotency fields.

## Setup

Apply the repository migrations through the normal release coordinator. The
archive is not exposed as direct public tables. RLS is enabled, public,
anonymous, and authenticated table access is revoked, and the capture RPC is
granted only to `service_role`.

## Capture API

Use the Edge Function route:

```text
POST /functions/v1/momi-communications-capture-openai-message-v1
```

This route requires a gateway-verified Supabase user or service-role JWT.

Expected payload:

```json
{
  "source_account_key": "openai:workspace-a",
  "source_user_key": "user:lydia",
  "source_conversation_key": "chatgpt-conversation-123",
  "source_message_key": "message-456",
  "sender_role": "user",
  "occurred_at": "2026-07-16T10:00:00.000Z",
  "idempotency_key": "openai/workspace-a/chatgpt-conversation-123/message-456",
  "source_metadata": { "surface": "chatgpt" },
  "payload": { "content": "Original source message payload" },
  "raw_text": "Original source message payload",
  "capture_actor": "chatgpt-export-importer-v1",
  "tool_version": "importer-0.1.0"
}
```

The response is `stored` for a new archive item or `duplicate` when the source
identity or idempotency key already exists with the same content hash.

## Operational Note Action

Account-wide ChatGPT instructions use the Supabase plugin's SQL execution tool
only to call the private structured RPC below. They must not insert, update, or
delete archive tables directly.

```sql
select *
from momi_communications.capture_operational_note_v1(
  $momi$
  {
    "source_account_key": "chatgpt:account-a",
    "source_user_key": "person:lydia",
    "note_type": "decision",
    "summary": "Use synthesized operational memories instead of raw chat turns.",
    "supporting_context": "The decision emerged across several messages.",
    "open_questions": [],
    "actors": ["Lydia"],
    "confidence": 0.95,
    "source_surface": "chatgpt",
    "conversation_hint": "communications archive design",
    "prompt_version": "momi-operational-memory-v1"
  }
  $momi$::jsonb
);
```

The four required fields are `source_account_key`, `source_user_key`,
`note_type`, and `summary`. Configure a different stable account key in each
ChatGPT account's instructions. Supply a native conversation key when the
surface exposes one; otherwise the RPC derives a stable fallback and retains
the optional conversation hint.

The RPC derives account-scoped message and idempotency keys when the caller
does not provide one. It stores an immutable `candidate_operational_memory`
payload with provenance stating that it is a conversation synthesis and that
raw turns are not included. It then reuses the original capture transaction,
which creates one pending evaluation job for a new item.

## Evaluation Contract

Every new archive item creates one `pending` row in
`momi_communications.evaluation_jobs`. The queued job contains only archive
identity, evaluator contract key, capability token, status, and processing
metadata. Classifier output, flags, urgency, confidence, archive/noise
decisions, and merge suggestions belong in `communication_evaluations`.

The evaluator makes no Edge or model request when no work is due. Health fails
with a redacted `503` when runtime configuration is incomplete. A service-role
operator may dispatch one exact canary job and read redacted job or queue
status; these RPCs never return source content or capability tokens.
Canary activation enables only the exact HTTP route; scheduling stays inactive until both canaries pass.
Exact input, model output, leases, retries, activation, and neutral routing are
documented in the [`evaluator function guide`](../services/communications-archive/functions/momi-communications-evaluate-item-v1/README.md).

## Corrections And Derived Work

Tasks, knowledge, incidents, alerts, and other derived records are appended to
`derived_records`. Human or model corrections are appended to `corrections`.
Neither table rewrites the immutable source archive.

## Future Sources

Add a new source by inserting a `source_types` row, adding a source-specific
capture RPC or wrapper, and mapping its account/user/thread/message identity
into `archive_items`. Operational notes retain OpenAI provenance. Do not add
Slack, email, SMS, ClickUp, or hardware adapters in this slice.

## Tests
```text
pnpm run test -- --service communications-archive
```
