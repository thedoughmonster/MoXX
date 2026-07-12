# Toast Order Alert Pipeline V1

## Purpose

This contract completes the first hydrated Toast order to Slack alert path.
Every stage starts from durable warehouse work and remains independently
retryable and idempotent.

## Decision Input

The decision worker accepts only `work_id` and that work row's capability token.
It atomically claims Order API work, calls the exact registered MoMi Order API
route with the stored order GUID, and passes the returned complete order document
to the configured warehouse claim function.

The worker never reads a raw table, approved view, or Toast API directly. The
MoMi Order API remains the only order read boundary.

## Eligibility

Source mappings, rule conditions, routes, and Slack destinations are independent
database configuration with independent enable switches. Paths are evaluated
against the hydrated order document returned by the MoMi Order API.

Exactly one matching route claims one candidate for `order_guid + alert_kind`.
Ambiguous or unmapped matches claim nothing and remain visible in the work
outcome. Candidate provenance includes the hydration job, order resource version,
Order API work, rule version, and causing raw event when one exists.

## Slack Delivery

A claimed candidate creates durable Slack delivery work before any network call.
The Slack adapter accepts only the delivery work id and its capability token,
loads a versioned prepared-message view, and calls Slack `chat.postMessage` with
the configured channel.

The delivery idempotency key is the candidate id. Attempts store timestamps,
deployment identity, Slack status, safe response metadata, and errors. A
successful delivery is never sent again by a retry.

## Failure Behavior

API, decision, or Slack failures leave durable failed work that can be reclaimed.
No stage falls back to Toast, a raw table, or a hardcoded destination. Disabled
sources, rules, routes, or destinations produce no candidate or message.
