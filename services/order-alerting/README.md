# Order Alerting

## ELI5

MoMi gives this service a saved order. It checks the configured alert rules,
takes one readable snapshot, and creates one delivery job for every enabled
destination. It does not know how to talk to Toast or Slack.

## Purpose

This source-neutral capability owns order alert decisions, idempotent candidate
claims, destination fan-out, presentation snapshots, and durable delivery work.

## Owned Function

`momi-order-alert-worker-v1` starts from durable API work and invokes only the
exact owned reader route recorded for that work.

## Contracts

The service consumes durable order work from stored webhook or hydration
sources and a registered order reader contract. It provides
`momi.order_alert.delivery_work.v1` for destination adapters.

## Authority

The service can read runtime configuration and order work, then write alert and
delivery state. It cannot call Toast, Square, Slack, or another vendor.

## Verification

Run `npm run check -- --service order-alerting` with Node.js 24.
