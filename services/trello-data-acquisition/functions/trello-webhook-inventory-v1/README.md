# Trello Webhook Inventory v1

## ELI5

This worker uses one durable permission slip to read Trello's complete webhook
inventory and records the source response before anyone acts on it.

## Trigger And Input

`POST /functions/v1/trello-webhook-inventory-v1` accepts only a durable `job_id`
and its single-job `capability_token`.

## Output

After durable recording, the response returns the complete safe source response
through the acquisition contract. It never returns Trello credentials or
authentication headers.

## Side Effects

The worker claims one board-scoped inventory job, performs the exact allowlisted
token-webhooks GET, and stores the status, safe headers, parsed payload, and raw
text. The board ID is provenance and does not alter the provider route.

## Failure Handling

HTTP failures are preserved as source responses. Network failures are recorded
without blind retry. Logs contain only the durable job identity and error name.

## Tests

Tests cover strict parsing, the exact allowlisted route, complete response
capture, secret-negative logs, and private migration authority.
