# Slack Order Alert Delivery v1

## ELI5

Another MoMi service prepares an alert, chooses its Slack channel, and puts a
durable delivery job in the database. This adapter claims that job, sends the
prepared message exactly once to Slack, and records what happened. It does not
know or care whether the order came from Toast, Square, or another source. The
prepared Block Kit message shows order details, items, and modifiers, never the
source order GUID.

## Purpose

This destination adapter sends one prepared, durable order alert to its
configured Slack channel and records the delivery result.

- Function key: `momi.slack.order_alert.deliver.v1`
- Route: `/functions/v1/slack-order-alert-delivery-v1`
- Owner: `slack-order-delivery`
- Boundary: Slack outbound

## Trigger And Input

`POST` accepts only `work_id` and its `trigger_token`; see
`contracts/input.schema.json`. Authorization is bound to the durable Slack work
row. Gateway JWT verification is disabled because that per-work capability is
the authorization boundary. An already successful work item is never sent again.

## Output

The response reports the durable delivery disposition and work identifier. It
never returns the Slack token or prepared business payload.

## Durable Flow

1. Atomically claim eligible delivery work and create an attempt.
2. Load the snapshotted, versioned Block Kit message and configured channel.
3. Call only Slack `chat.postMessage` with that prepared payload.
4. Persist safe Slack response metadata and mark the work succeeded or failed.

Retries use the `momi.alert.candidate.v1` idempotency policy at the alert
candidate and delivery work boundaries.

## Side Effects

The adapter records a delivery attempt, posts the prepared message to the
configured channel, and stores only approved Slack response metadata.

## Failure Handling

Network, HTTP, Slack API, and durable-state failures are recorded with stable
codes and safe metadata. Successful work is never resent; failed work remains
available to configured retry policy.

## Authority Boundary

This function may send prepared messages to Slack. It never fetches business
data, calls an order provider, evaluates alert rules, or changes destination
selection.

## Configuration

- `SUPABASE_DB_URL`: private database connection supplied by Supabase.
- `SLACK_BOT_TOKEN`: Slack bot credential.
- `MOMI_CODE_COMMIT_SHA`: deployed source revision recorded with attempts.
- Channel, route, and destination enablement live in database configuration.

## Tests

See the [function manifest](function.json), [service rules](../../AGENTS.md),
and [alert pipeline contract](../../../../docs/contracts/momi-order-alert-pipeline-v1.md).
Run `npm run check -- --service slack-order-delivery` from the repository root.
