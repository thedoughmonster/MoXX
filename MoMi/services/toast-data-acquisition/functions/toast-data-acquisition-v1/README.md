# Toast Data Acquisition v1

## ELI5

This function opens an approved Toast fetch job, downloads one page, saves the
whole answer, and leaves either a completion stamp or a bookmark for more data.
Configured exact-resource work can continue with another durable job during the
same bounded worker lifetime.

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
5. Deduplicate immutable resource versions, return the winning immutable version
   even during a concurrent conflict, add every observation, fan payment GUID
   lists into registered detail jobs, and advance the durable lifecycle.
6. For a batch-enabled exact-resource operation, atomically complete the current
   job and claim one next due job. The HTTP request returns after the first job;
   Supabase background work uses the configured worker-lifetime envelope. A new
   handoff is allowed only while one full source timeout, persistence reserve,
   and platform shutdown reserve remain before the absolute invocation deadline.
   Internal handoffs do not impersonate external scheduler dispatches, allowing
   the configured worker pool to refill without weakening source-call pacing.

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
An interrupted background worker leaves at most one leased job; normal lease
recovery resumes it. A durable reconciliation job closes any source-attempt row
left open by platform termination after its job is no longer actively leased.
Jobs are never pre-claimed in an in-memory batch.

## Configuration

`SUPABASE_DB_URL` supplies the private database connection. Toast host, timeout,
credential secret names, operation paths, and parameters come from the private
registry. External dependencies are pinned by the Edge adapter `deno.json`.
Batch enablement, worker lifetime, job ceiling, and active-worker capacity are
private operation-registry settings. The configured envelope may match
Supabase's paid 400-second worker ceiling because handoff eligibility reserves
the source timeout and shutdown budget rather than running to that hard cutoff.
That ceiling belongs to the reusable worker instance, not an individual request,
so lease recovery remains the correctness boundary. The payment-detail worker
is capped at 500 jobs per invocation.
The dispatcher materializes a small per-operation candidate rank before running
source-pacing lookups, so queue depth does not lengthen its wake-up interval.

## Authority Boundary

Only enabled registered GET operations may reach the configured HTTPS Toast base
URL. The caller cannot supply a URL, method, header, or source parameter.

## Tests

Focused tests cover request rejection, redaction, token refresh, recovery
classes, response shapes, deduplication SQL, 204 coverage, pagination, atomic
job handoff, worker capacity, and bounded background continuation. Run
`npm run check -- --service toast-data-acquisition` from the repository root.
