# Communications Archive

## ELI5

This service saves source communications exactly as received and can also save
an agent-authored candidate memory when raw turns are unavailable. Every item
gets a durable evaluation ticket for model-backed review.

## Boundary

The archive is channel-neutral. OpenAI and ChatGPT messages are the first
capture contract, but source account, user, conversation, message, sender role,
timestamps, payload, and metadata are stored through common archive columns.
Operational notes are explicitly marked conversation syntheses, not raw turns.

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

## Evaluation

Every newly captured item inserts one `pending` row in
`momi_communications.evaluation_jobs`. The scheduled dispatcher wakes no worker
when the queue is empty. When work is due, it sends only one job identity and
capability token to `momi-communications-evaluate-item-v1`.

The evaluator claims a short lease before reading the candidate through a
structured database function. It calls the configured OpenAI model with a
strict output schema, then atomically appends an evaluation, optional derived
records, and audit evidence. Failures retry with backoff and eventually become
dead letters. ClickUp and GitHub delivery are intentionally separate.

The registry route and schedule ship inactive. After the hosted function has
the `OPENAI_API_KEY` and `MOMI_COMMUNICATIONS_EVALUATOR_MODEL` secrets, the
canary migration activates only the exact route. It explicitly leaves the
30-second schedule inactive until controlled canaries pass.

`dispatch_evaluation_job_v1` wakes one exact due job for a controlled canary.
`get_evaluation_job_status_v1` and `get_evaluation_queue_status_v1` expose only
processing state and counts. All three contracts are service-role-only and
never return source content or capability tokens.

## Tests

Run `pnpm run test -- --service communications-archive` from the repository
root, or run the repository check before release.
