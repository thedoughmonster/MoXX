# Communications Archive

## ELI5

This service saves source communications exactly as received and can also save
an agent-authored candidate memory when raw turns are unavailable. Every item
gets a small evaluation ticket for later review.

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
`momi_communications.evaluation_jobs`. A future evaluator claims that durable
job and writes classifier outputs to `communication_evaluations`.

## Tests

Run `pnpm run test -- --service communications-archive` from the repository
root, or run the repository check before release.
