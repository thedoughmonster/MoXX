# Communications Gateway

## ELI5

This service is the guarded front door between OpenWebUI and MoMi's configured
model provider. It checks who may use the beta, per-minute and per-day request
limits, token ceilings, timeouts, and how much each user may spend,
records the complete exchange, and exposes only approved MoMi tools.

## Boundary

The gateway owns access, limits, provider/model binding, invocation and attempt
state, usage/timing/error metadata, and safe replay. It does not own immutable
message evidence, curated logs, canonical shop truth, OpenWebUI state, or any
provider credential outside its runtime secret store.

`momi-assistant` automatically selects a bounded Quick, Standard, or Deep
profile through a small structured-output router. Provider-neutral explicit
profiles bypass the router, and Maximum is explicit-only. Per-user default and
maximum profiles are independently adjustable. Same-key/same-payload requests
replay safely; changed payloads fail; an ambiguous paid result pauses for
reconciliation. Final success requires the archive owner's terminal receipt.

Provider execution prefers the beta-specific `MOMI_BETA_PROVIDER_API_KEY` and
may reuse the existing project-scoped `OPENAI_API_KEY` during beta activation.
Neither value is returned, logged, archived, or exposed to OpenWebUI. Provider
requests use the authenticated user's opaque UUID as `safety_identifier` and
the current `max_completion_tokens` field.

## Tools

The model sees bounded canonical order, payment, menu, schedule, and stock
readers and `create_momi_log`. Every shop read uses a one-use capability issued
by `warehouse-read-api`. No arbitrary HTTP, SQL, shell, attachment, source API,
or other business mutation is available.

## Tests

Run `pnpm check -- --service communications-gateway`.
