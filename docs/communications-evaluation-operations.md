# Communications Evaluation: Schedule-Off Operations

This procedure covers approved development operators using the evaluator while
its automatic schedule remains inactive. It is not a client interface, a
production procedure, or authority to process the backlog.

## Invariants

- Keep `momi-communications-evaluator-wakeup-v1` inactive.
- Dispatch only one explicitly selected, due evaluation job at a time through
  `momi.communications.dispatch_evaluation_job.v1`.
- Read only redacted state through
  `momi.communications.get_evaluation_job_status.v1` and
  `momi.communications.get_evaluation_queue_status.v1`.
- Never log communication content, model output, capability tokens, config
  values, or secret values.
- Never use this procedure against production.

## Pause

1. Stop exact-job dispatch.
2. Attest that the 30-second cron unit remains inactive.
3. Read the redacted queue summary and record counts only.

No database row, lease, or job state is changed merely to declare a pause.

## Resume One Job

1. Confirm required configuration is present without reading its values.
2. Confirm the cron unit is inactive and no other operator owns the job.
3. Select one known due job below the five-attempt limit.
4. Dispatch that exact job identity through the public command.
5. Poll only its redacted status until it completes or returns a bounded
   failure.
6. Stop again; do not drain another job implicitly.

A duplicate or stale dispatch must return no work and must not make a model
request. Failed jobs may be selected again only when due and below five
attempts.

## Fail-Closed Stops

Stop without another dispatch when any of these is true:

- the cron unit is active;
- the job is dead-lettered, not due, or ambiguously claimed;
- required configuration is missing;
- registry ownership, route state, or migration parity is unexpected;
- redacted status cannot prove the result; or
- any payload, token, model output, or secret appears in logs.

Dead-letter release, backlog processing, automatic scheduling, production use,
release, deployment, and secret changes require separate accepted procedures
and authority.
