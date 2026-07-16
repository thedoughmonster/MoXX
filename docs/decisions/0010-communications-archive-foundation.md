# 0010: Communications Archive Foundation

- Status: accepted
- Date: 2026-07-16

## Context

MoMi needs an auditable record of communications that can span ChatGPT/OpenAI
accounts first and other channels later. The archive must preserve original
messages while later evaluation, task extraction, corrections, incidents,
alerts, and state decisions evolve separately.

Existing Toast raw schemas are source-owned and business-data focused. Reusing
them for human/agent communications would couple a channel-neutral archive to a
vendor-specific source boundary. Existing alerting and event-routing services
also make decisions or route durable work, but they do not own immutable source
communications.

## Decision

Create a new `communications-archive` core capability service and a private
`momi_communications` schema.

The schema owns channel-neutral source account, user, conversation, message,
payload, source metadata, provenance, idempotency, evaluation staging,
correction, derived-record, and audit tables. OpenAI/ChatGPT capture is the
first source-specific contract and is implemented through the structured
`momi_communications.capture_openai_message_v1` database function plus a thin
internal Edge Function wrapper.

When ChatGPT cannot expose stable raw turn identities, account instructions use
`momi_communications.capture_operational_note_v1`. That strict RPC archives an
agent-authored synthesis as an explicitly marked candidate memory and reuses
the original capture transaction. It does not represent the synthesis as a raw
turn or as a validated evaluator conclusion.

Direct table access remains private. Agents and importers use the structured
capture contract so duplicate source identities and idempotency keys collapse
without rewriting immutable source records. Every new archive item creates one
durable pending evaluator job; actual classification and derived actions remain
separate future work.

This decision does not add Slack, email, SMS, ClickUp, MoMe/PTT, hardware, or
general orchestration adapters.

## Consequences

- Multiple OpenAI/ChatGPT accounts can be archived without source identity
  collisions.
- Future communication sources can map their native identities into the same
  archive item contract without redesigning the core archive.
- Source records remain immutable, while evaluations, corrections, and derived
  records stay append-only and auditable.
- Account-instruction agents can submit a multi-turn synthesis without needing
  direct transcript access or fabricating native message identifiers.
- The new service owns one schema and one capture function boundary, satisfying
  the service and schema ownership rule without adding external network access.
