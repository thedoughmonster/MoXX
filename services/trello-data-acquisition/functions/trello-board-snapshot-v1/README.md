# Trello Board Snapshot v1

## ELI5

This worker uses one durable permission slip to read the complete current shape
of one Trello board and records the response before anyone uses it.

## Trigger And Input

`POST /functions/v1/trello-board-snapshot-v1` accepts only a durable `job_id`
and its single-job `capability_token`. New jobs are woken after commit through
the allowlisted internal route. A one-minute recovery schedule rotates the
private token and repeats a missed wake or an expired claim.

## Output

After durable recording, the response returns the complete safe source response
through the acquisition contract. It never returns Trello credentials or
authentication headers.

## Side Effects

The function claims one due acquisition job with a 120-second lease, performs
one allowlisted Trello board read, and stores the complete status, safe headers,
parsed payload, and raw response text in the acquisition owner's private
dataset. Recovery stops after three expired claims.

## Failure Handling

Invalid, stale, and expired work is rejected before source access. HTTP and
network failures are recorded as terminal complete attempts without blind
provider retry. The source request aborts after 90 seconds, before its claim
lease can expire. A missed database-to-worker wake or abandoned claim remains
recoverable from durable state. Logs contain only the durable job identity and
error name.

## Tests

Tests cover strict work parsing, header-based credential custody, allowlisted
URL construction, complete response capture, migration permissions, missed
wakes, claim leases, bounded recovery, and exact internal dispatch payloads.
