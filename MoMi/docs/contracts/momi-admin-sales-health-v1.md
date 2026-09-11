# MoMi admin sales health v1

Owner: warehouse-read-api. Consumer: the private Dough Monster admin server,
Sites project appgprj_6a9ffac3acd481918a274f6acf285342.
Authority: MOX-583; user requested permanent live admin access September 11.

## Admission
GET /functions/v1/momi-admin-data-v1/sales/health accepts only Authorization:
Bearer with the configured MOMI_ADMIN_DATA_TOKEN. The credential is an opaque,
random, minimum 256-bit, base64url value (43–128 characters). No query or body
is accepted. Root GET is a public, side-effect-free 200 liveness probe.

The credential permits only the fixed dough-monster-admin consumer and
sales/health resource. It grants no database login or other module scope.
A private enabled consumer mapping chooses the primary analysis scope.
At most six admissions per minute are allowed. Each admission commits a
30-second one-use capability before a separate transaction atomically consumes
it and reads the payload. Disabling the mapping also blocks issued capabilities.
Consumed and expired capabilities older than one day are pruned, at most 128
per successful admission; this bounded authorization history contains no orders.

The API assumes its manifest-owned non-login svc_warehouse_read_api role and
uses six-second statement limits. Business data is read only through approved
views; the role can update only its own admission counters and capabilities.
No caller chooses a relation, location, date range or SQL.

## Payload
SalesHealthDataset schemaVersion 1 uses configured location/timezone and
bucketMinutes 15. It includes today and the previous 729 calendar dates, ordered
by date. It exposes only non-voided recorded order sales/counts, under-$40
sales/counts, channel totals, 15-minute totals, and missing amount/time counts.
Unknown times are omitted from buckets and remain disclosed in missingTimes.
Missing amounts contribute no known sales and remain disclosed in missingAmounts.
Absent dates remain absent; zero activity is not invented for missing days.

capturedAt is the database snapshot time. latestObservation is the latest
available scoped order observation, including voided orders; it is not a
verified ingestion watermark. The response deliberately omits completeThrough.
Scheduled orders remain recorded in their actual local time bucket; the admin
excludes buckets beyond the available complete interval from current pace.

Responses are JSON, at most 2 MB, private/no-store, and vary on Authorization.
401 denies invalid credentials. Invalid request shape is 400; unsupported
routes/methods are 404/405. Unconfigured or unavailable reads are 503 with safe
errors. Successful nonempty reads do not prove that upstream ingestion is current.

## Custody, activation and revocation
Zac places the separate target credential directly in the MoMi Edge Function
secret MOMI_ADMIN_DATA_TOKEN and the private Sites server secret
ADMIN_DATA_API_TOKEN; never in chat, repository files, logs or local env files.
ADMIN_DATA_API_URL names the exact target root above. Development and production
use different values and their own project references. No credential is copied
from one hosted store to another. The persistent connection uses an owner-held
credential until revoked; rotate after exposure, owner/scope change, failed
verification or the end of active development. MOX-583 records this purpose-bound
runtime credential exception; it grants no Supabase account/PAT access.

Application and backend use only their own protected placement. No network
allowlist is asserted: the Sites runtime has no verified fixed egress address.
TLS and the scoped credential protect this server boundary. Supabase DB pool
connection custody remains unchanged and never reaches the application.

Release an uncredentialed endpoint via the existing receipt-bound path, place
credentials per target through the owner, then enable application configuration.
Prove a successful current read, denied unauthenticated read, and retained-data
failure. Revoke by disabling the consumer and removing/rotating its credential.
Rollback disables the new consumer first, restores the explicitly labeled
snapshot application configuration, verifies, then revokes the replacement.
Never restore the retired temporary feed. Existing UI publication is separate.
