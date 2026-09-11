# Admin data v1

## ELI5
The private admin asks one guarded MoMi entry point for current sales totals.
The server credential admits only its configured sales resource. Each admitted
request issues and consumes a private, expiring one-use read capability.
This consumer permission is provisional until the official dashboard goes live
in production. Its cutover must disable the interim consumer, revoke its
credentials, and verify new requests and outstanding capabilities are denied.
No automatic launch trigger or transfer of this credential is implemented.

## Trigger And Input
GET /functions/v1/momi-admin-data-v1/sales/health, server to server.
GET of the root is a side-effect-free liveness probe.

A server bearer credential in Authorization. No body, query, SQL, or client
location selector. The configured consumer resolves primary scope in the
facade-owned primary configuration and the warehouse's declared canonical
sales source view. Raw warehouse tables remain inaccessible to the reader role.

## Output
SalesHealthDataset v1: at most 730 calendar dates including today in the scope
timezone; aggregate totals, channels and 15-minute buckets. Captured time and
latest source observation are distinct. No ingestion completeness is inferred.

## Side Effects
Owned admission counters and expiring read capabilities only. No business-data
writes, source fetches, or cross-service HTTP. Expired capabilities are pruned
in bounded batches during admission.

## Failure Handling
Invalid access is denied before a database read. Missing configuration, revoked
admission, throttling, timeouts, query failure or output above 2 MB fails closed.
Responses never include secrets or raw errors. The admin retains prior data.

## Tests
Run the owner admin handler and PostgreSQL contract tests, then the focused
changed-path gate and authoritative PR validation. Controlled acceptance uses
one authenticated read and one unauthenticated denial after credential placement.
