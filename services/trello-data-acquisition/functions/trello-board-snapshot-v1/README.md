# Trello Board Snapshot v1

## ELI5

This worker uses one durable permission slip to read the complete current shape
of one Trello board and records the response before anyone uses it.

## Trigger And Input

`POST /functions/v1/trello-board-snapshot-v1` accepts only a durable `job_id`
and its single-job `capability_token`.

## Output

After durable recording, the response returns the complete safe source response
through the acquisition contract. It never returns Trello credentials or
authentication headers.

## Side Effects

The function claims one queued acquisition job, performs one allowlisted Trello
board read, and stores the complete status, safe headers, parsed payload, and
raw response text in the acquisition owner's private dataset.

## Failure Handling

Invalid work is rejected before source access. HTTP failures are recorded as
complete source responses. Network failures are recorded without blind retry.
Logs contain only the durable job identity and error name.

## Tests

Tests cover strict work parsing, header-based credential custody, allowlisted
URL construction, complete response capture, and migration permissions.
