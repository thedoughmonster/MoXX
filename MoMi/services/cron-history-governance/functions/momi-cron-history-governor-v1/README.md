# `momi-cron-history-governor-v1`

## ELI5

Once a minute, this worker checks the database's official health gauges. It
hands a small sanitized reading to the database, which either performs one
careful filing step or refuses to touch anything.

## Trigger And Input

`POST` accepts only one database-issued `tick_id` and `capability_token`. `GET`
returns a redacted configuration check. A side-effect-free `OPTIONS` request
proves deployment liveness without weakening readiness. The pg_cron dispatcher
sends the token only while an operator-selected phase is active.

The runtime requires `SUPABASE_DB_URL`, `SUPABASE_URL`, `DENO_DEPLOYMENT_ID`, and
only the runtime-injected JSON entry `SUPABASE_SECRET_KEYS['default']` for metrics.
Before any request, the URL must be the exact canonical dev/prod project origin
and match the deployment ID's project. No legacy/custom/PAT fallback or secret
listing, copying or configuration is allowed. The key has broad `service_role`
authority, not metrics-only privilege; rotation affects its other consumers.
Owner runtime-source selection records consent, not live credential presence or
authentication. `GET configured` checks parser/project presence only. Runtime
presence remains unverified until that deployed check; cleanup also requires
15 complete authenticated one-minute health samples. PostgreSQL derives provider
pressure from the accepted CPU, RAM/swap, I/O, and allocated-disk thresholds after
counter deltas are available; no guessed or separately named warning series is
accepted.

## Output

The response contains only tick, phase, disposition, sanitized counts, and a
stop reason. It never includes the Metrics API body, a command, a return
message, a secret, or a capability token.

## Side Effects

The worker performs one same-origin Metrics API request and calls only owned
database routines. The routine records one health sample and may run one bounded
transaction. Replays return the existing tick receipt.

## Failure Handling

Invalid input returns `400`; unknown tokens return `401`; missing metrics or
configuration returns a redacted `503` and no cleanup. After an ambiguous
database response the worker attempts one exact receipt readback. Absence of a
receipt is reported as `unknown_commit`; the next dispatcher pauses the
governor. There is no request loop or catch-up execution.
Failed post-deployment configuration verification blocks a release success
receipt and leaves cleanup disarmed. Release SQL may already have committed;
report partial state and reconcile it without automatic replay.

## Tests

Run `pnpm test -- --service cron-history-governance`. Tests cover parsing,
sanitization, missing metrics, replay, and unknown-commit readback.
