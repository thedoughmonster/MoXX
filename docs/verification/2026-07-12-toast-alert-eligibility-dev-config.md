# Toast Alert Eligibility Dev Configuration

- Date: 2026-07-12
- Environment: persistent Supabase `dev` branch
- Result: configured and disabled

## Source

- Key: `toast_in_store`
- Display name: `Toast In Store`
- Match path: `details.order.source`
- Match value: `In Store`
- Order GUID path: `details.order.guid`
- Enabled: `false`

## Rule

- Alert kind: `new_order`
- Version: `1`
- Enabled: `false`
- Condition 1: `eventType` equals `order_updated`
- Condition 2: `details.order.approvalStatus` equals `APPROVED`
- Condition 3: `details.order.voided` equals `false`

## Destination

- Key: `momi_dev_alerts`
- Slack channel: private `momi-dev-alerts`
- Slack channel ID: `C0BGPEE4A4V`
- Enabled: `false`
- Route enabled: `false`

## Verification

A representative In Store event matched no rules while all switches were off.
Inside a rolled-back transaction, enabling the source, rule, route, and
destination produced exactly one candidate. The transaction left no test event
or candidate behind. Production was not changed.
