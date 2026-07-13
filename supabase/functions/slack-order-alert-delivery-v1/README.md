# Slack Order Alert Delivery v1

## Purpose

This destination adapter sends one prepared, durable order alert to its
configured Slack channel and records the delivery result.

- Function key: `toast.slack_order_alert.deliver.v1`
- Route: `/functions/v1/slack-order-alert-delivery-v1`
- Boundary: Slack outbound

## HTTP Contract

`POST` accepts only `work_id` and its `trigger_token`; see
`contracts/input.schema.json`. Authorization is bound to the durable Slack work
row. Gateway JWT verification is disabled because that per-work capability is
the authorization boundary. An already successful work item is never sent again.

## Durable Flow

1. Atomically claim eligible delivery work and create an attempt.
2. Load the versioned prepared message and configured channel from the warehouse.
3. Call only Slack `chat.postMessage` with that prepared payload.
4. Persist safe Slack response metadata and mark the work succeeded or failed.

Retries are idempotent at the alert candidate and delivery work boundaries.

## Authority Boundary

This function may send prepared messages to Slack. It never fetches business
data, calls Toast, evaluates alert rules, or changes destination selection.

## Configuration

- `SUPABASE_DB_URL`: private database connection supplied by Supabase.
- `SLACK_BOT_TOKEN`: Dough Monster Ops bot credential.
- `MOMI_CODE_COMMIT_SHA`: deployed source revision recorded with attempts.
- Channel, route, and destination enablement live in database configuration.

See the [function manifest](function.json), [local rules](AGENTS.md), and
[alert pipeline contract](../../../docs/contracts/toast-order-alert-pipeline-v1.md).
Run `npm test` from the repository root with Node.js 24.
