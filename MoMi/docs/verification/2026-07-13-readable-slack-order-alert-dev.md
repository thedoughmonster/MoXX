# Readable Slack Order Alert Dev Verification

- Date: 2026-07-13
- Environment: persistent Supabase `dev` project
- Result: passed
- Production changed: no

## Source Evidence

Toast webhook records still carry order identity rather than receipt details.
The hydrated Orders API resources currently stored in `toast_raw.orders` contain
9 top-level selections and 25 modifiers including nested modifiers. Every one has a non-empty
`displayName`; no Menu API lookup is involved.

The complete Toast payload remains unchanged. The approved Toast reader view
derives a separate source-neutral presentation with:

- Display number
- Fulfillment timestamp and epoch
- Item quantity and readable name
- Flattened, depth-preserving modifier quantity and readable name
- Item count and order total

## Durable Contract

Alert candidates snapshot the presentation at claim time. Source label and ISO
currency code come from source configuration. Later source rehydration or
configuration changes cannot alter a queued message.

Dev source labels are `In Store` and `Out of Store`; both use configured `USD`.

The Slack prepared-message view emits accessible Block Kit and a plain-text
fallback. The destination payload contains no source order GUID. The random
Slack `client_msg_id` remains the delivery idempotency key.

## Hosted Verification

Applied dev migrations:

- `20260713080123_create_toast_order_alert_presentation_view`
- `20260713080132_add_order_alert_presentation_snapshot`
- `20260713080146_update_order_alert_claim_presentation`
- `20260713080155_format_slack_order_alert_messages`
- `20260713080437_fix_slack_order_alert_summary_newlines`

Deployed functions:

- Toast owned reader: version 4
- Source-neutral alert worker: version 5

Controlled durable work `4` completed with one attempt and HTTP `200` from both
deployed functions. It matched one configured source and claimed zero new
candidates because that order already had its alert identity. No duplicate
Slack message was sent.

The two prepared dev messages have zero fallback, block-count, header, or
section length violations under current Slack limits. Both have zero source
order GUID matches. The latest preview contains nine blocks with readable items
and nested modifiers.

## Verification

- Node: `24.14.0`
- Tests: `33 passed`, `0 failed`
- Changed handwritten files: all at or below `120` lines
- Security advisors: expected informational private-table RLS notices only
- Performance advisors: expected informational unused-index notices only

The Slack sender code and destination did not change. Its existing succeeded
delivery was not reset; the next genuinely new candidate is the first external
send of the new Block Kit payload.
