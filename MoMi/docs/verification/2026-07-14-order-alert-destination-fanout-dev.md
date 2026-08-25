# Order Alert Destination Fan-Out Dev Verification

- Date: 2026-07-14
- Environment: persistent Supabase `dev` branch
- Result: passed
- Production changed: no

## Slack Channel

- Private `momi-dev-all-orders`: `C0BH7947NGH`
- Members: Zac Hill, Lydia Heier, and `Dough Monster Ops`

## Schema

Applied migrations:

- `20260714064712_enable_order_alert_destination_fanout`
- `20260714064723_update_order_alert_claim_destination_fanout`
- `20260714065124_cover_order_alert_candidate_route_fk`

Alert routes are now keyed by source, alert kind, and destination. Candidate
idempotency includes the destination. Historical candidate routes missing from
current configuration were retained as disabled tombstones before the stronger
foreign key was added.

## Dev Configuration

Enabled destination `momi_dev_all_orders` targets the new channel. Enabled
`new_order` routes connect both `toast_in_store` and
`toast_out_of_store` to it. Their existing source-specific routes remain
enabled, and the legacy `momi_dev_alerts` destination remains disabled.

## Rollback-Only Proof

Existing in-store and out-of-store work was evaluated inside a transaction
that was rolled back. The in-store example claimed its two missing enabled
destinations; the out-of-store example claimed its one missing enabled
destination. Repeating each evaluation in the same transaction claimed zero.

Both examples reported one unambiguous rule match. No candidate, delivery work,
HTTP request, or Slack message survived the rollback.
