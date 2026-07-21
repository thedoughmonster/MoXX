# Communications Gateway

## ELI5

This service is the guarded front door between OpenWebUI and MoMi's configured
model provider. It checks who may use the beta and how much they may spend,
records the complete exchange, and exposes only approved MoMi tools.

## Boundary

The gateway owns access, limits, provider/model binding, invocation and attempt
state, usage/timing/error metadata, and safe replay. It does not own immutable
message evidence, curated logs, canonical shop truth, OpenWebUI state, or any
provider credential outside its runtime secret store.

Only `momi-assistant` is listed. All route, provider, and cohort records ship
inactive. Same-key/same-payload requests replay safely; changed payloads fail;
an ambiguous paid result pauses for reconciliation. Final success requires the
archive owner's terminal receipt.

## Tools

The model sees bounded canonical order, payment, menu, schedule, and stock
readers and `create_momi_log`. Every shop read uses a one-use capability issued
by `warehouse-read-api`. No arbitrary HTTP, SQL, shell, attachment, source API,
or other business mutation is available.

## Tests

Run `pnpm check -- --service communications-gateway`.
