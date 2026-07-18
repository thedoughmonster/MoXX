# Slack Order Delivery

## ELI5

This service receives a finished message and a Slack destination, sends that
message once, and records what Slack said. It never looks up the order itself.

## Purpose

This destination adapter owns Slack formatting transport, delivery attempts,
retry outcomes, and success metadata for durable order alerts.

## Owned Function

`slack-order-alert-delivery-v1` claims one delivery work item and calls only
Slack `chat.postMessage` with the prepared payload.

## Contracts

The service provides `momi.slack.order_alert.deliver.v1`. Its current prepared
message view reads the order-alert candidate snapshot through recorded
transition debt; a later owner-view cutover will remove that direct access.
Source and destination enablement remain independent database controls.

## Authority

The service may read prepared alert messages, update delivery state, and contact
`slack.com`. It cannot fetch order data or call a source API.

## Verification

Run `npm run check -- --service slack-order-delivery` with Node.js 24.
