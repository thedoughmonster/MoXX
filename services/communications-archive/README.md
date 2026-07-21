# Communications Archive

## ELI5

This service preserves JSON source evidence exactly as received, including an
agent-authored candidate memory when raw turns are unavailable. Evaluation is
owned by the separate communications-evaluation service.

## Boundary

The archive is channel-neutral. OpenAI and ChatGPT messages are the first
capture contract, but source account, user, conversation, message, sender role,
timestamps, payload, and metadata are stored through common archive columns.
Operational notes are explicitly marked conversation syntheses, not raw turns.

The same dataset boundary owns current `toast_raw` evidence during the physical
schema transition. Source-specific adapters do not own those raw relations.
Archive-owned Toast trigger adapters emit only immutable evidence references;
the event router owns storage and fanout and does not own source event meaning.

## Immutability

`momi_communications.archive_items` preserves source records. Later judgments,
merged interpretations, tasks, knowledge, incidents, alerts, and corrections
live in separate append-only tables so the original source communication stays
auditable.

## Capture

Call `momi_communications.capture_openai_message_v1` or its thin Edge Function
wrapper for original messages. Account-instruction agents call
`momi_communications.capture_operational_note_v1` with one strict JSON object.
Replays return the existing item and do not duplicate evaluator work.

The production beta additionally calls
`momi_communications.capture_gateway_exchange_v1` for ordered model-boundary
evidence and `momi_communications.capture_human_message_v1` for committed
OpenWebUI user-to-user messages. Both contracts are idempotent and immutable.
The purpose-bound receipt reader returns identifiers, content hashes, order,
status, usage, and timing only; it never returns protected values.

## Evaluation Handoff

Every original source item captured through an evaluation intake contract inserts one `pending` row in
`momi_communications.evaluation_jobs`. The scheduled dispatcher wakes no worker
when the queue is empty. When work is due, it sends only one job identity and
capability token to `momi-communications-evaluate-item-v1`.

The `communications-evaluation` owner claims the lease, calls the configured
model, and appends evaluation state. ClickUp and GitHub delivery remain outside
both archive and evaluation boundaries.

Gateway-exchange and committed human-message beta evidence is archive-only and
does not recursively enqueue model evaluation.

The registry route and schedule ship inactive. After the hosted function has
the `OPENAI_API_KEY` and `MOMI_COMMUNICATIONS_EVALUATOR_MODEL` secrets, the
canary migration activates only the exact route. It explicitly leaves the
30-second schedule inactive until controlled canaries pass.

Evaluator dispatch and status contracts belong to `communications-evaluation`.

## Tests

Run `pnpm run test -- --service communications-archive` from the repository
root, or run the repository check before release.
