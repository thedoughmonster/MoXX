# Toast Data Acquisition v1

## ELI5

This function opens one approved Toast fetch job, downloads one page, saves the
whole answer, and leaves either a completion stamp or a bookmark for more data.

## Purpose

`toast.data.acquisition.v1` is the only generic Toast API acquisition function.
It is an allowlisted source adapter, not a Toast proxy.

## Trigger And Input

`GET` is a health check. `POST` accepts only `job_id` and `capability_token` as
defined by `contracts/input.schema.json`. The token is checked atomically by
`toast_acquisition.claim_job`.

## Output

The response reports whether work completed, continued, was already complete, or
entered retry/dead-letter state. Source payloads and credentials are never
returned.

## Durable Flow

1. Claim the job and load its enabled source, operation, restaurant, and
   operation-parameter registry rows.
2. Resolve a bounded date window and construct the exact registered GET URL.
3. Authenticate using configured secret names and fetch one response page.
4. Archive every attempt with redacted headers and complete response evidence.
5. Deduplicate immutable resource versions, add every observation, fan payment
   GUID lists into registered detail jobs, and advance the durable lifecycle.

## Side Effects

The function writes request attempts, resource versions, observations, coverage
records, payment-detail acquisition jobs, and durable acquisition job state.

## Failure Handling

Expired or rejected tokens receive one fresh-token retry. A 409 for a supplied
page token is archived, clears that token, rotates capability, and safely
restarts page one. Authentication, network, 429, server, and invalid-response
failures use the database retry policy. Each successful page resets the failure
streak; expired leases still count durable crashes. Coverage records complete,
empty, partial, gap, accepted-gap, and dead-letter outcomes. A kitchen
fulfillment 204 is preserved as accepted gap coverage.

## Configuration

`SUPABASE_DB_URL` supplies the private database connection. Toast host, timeout,
credential secret names, operation paths, and parameters come from the private
registry. External dependencies are pinned by the Edge adapter `deno.json`.

## Authority Boundary

Only enabled registered GET operations may reach the configured HTTPS Toast base
URL. The caller cannot supply a URL, method, header, or source parameter.

## Tests

Focused tests cover request rejection, redaction, token refresh, recovery
classes, response shapes, deduplication SQL, 204 coverage, and pagination. Run
`npm run check -- --service toast-data-acquisition` from the repository root.
