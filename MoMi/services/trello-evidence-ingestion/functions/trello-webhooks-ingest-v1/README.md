# Trello Webhooks Ingest v1

## ELI5

This endpoint proves a Trello notice is genuine, then asks MoMi's immutable
archive to file the complete notice exactly once.

## Trigger And Input

- `HEAD /functions/v1/trello-webhooks-ingest-v1` is Trello's callback probe.
- `POST` accepts Trello's complete JSON webhook body and
  `X-Trello-Webhook` signature.
- The signature is HMAC-SHA1 over the exact body followed by the exact
  configured callback URL.

## Output

The HEAD probe returns `200` with no body. An authenticated POST returns
`ok: true` and either `stored` or `duplicate`.

## Side Effects

One immutable archive capture is attempted through
`momi.raw_json.capture_evidence.v1`. The raw body, complete parsed payload,
action/member snapshot, typed Trello references, and optional non-secret client
identifier are preserved. No Trello or downstream API call occurs.

## Failure Handling

- Missing runtime configuration returns `503`.
- Missing, malformed, or incorrect signatures return `401`.
- Authenticated malformed payloads return `400`.
- Unsupported methods return `405`.
- Durable archive failure returns `500` and logs only action identity and error
  name.

## Tests

Tests cover HEAD probes, exact callback-bound signatures, actor attribution,
external references, client-marker capture, duplicate replay, header/secret
redaction, and the archive migration's permission and idempotency rules.

## Configuration And Authority

`TRELLO_WEBHOOK_SECRET` and `SUPABASE_DB_URL` are hosted secrets.
`TRELLO_WEBHOOK_CALLBACK_URL` is non-secret signature-bound configuration.
No credential value belongs in Git, fixtures, logs, or task prompts.
