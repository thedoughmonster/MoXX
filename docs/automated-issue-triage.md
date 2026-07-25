# Automated issue triage

`.github/workflows/issue-triage.yml` produces one bounded triage record for each
new issue and supports explicit manual re-triage.

## Authority split

The model job has read-only repository/issue authority and no write token. Issue
text is untrusted. It sends only the generated bounded context and contract to
the model-execution gateway, which selects the provider mapping and records
safe operational metadata. The job emits schema-constrained JSON.

The writer is a separate job with issue-write authority and no model-gateway
credential. Before mutation it verifies the current open issue, related issue
existence/type, configured labels, safe text, and one idempotency marker.

## Authoritative contract

`.github/codex/issue-triage.config.json` configures labels by issue type.
The schema, runtime validator, prompt, and focused fixtures deterministically
check parity with that configuration.

Both `bug` and `feature` records retain one owning feature identity and the same
typed dependency graph. Relationship types are hard prerequisite, ordering
constraint, shared mutation/release boundary, external/user gate, and
independent. Labels are not relationship evidence. Safe rationale punctuation
includes issue references such as `#109`; markup, mentions, and
credential-shaped data remain forbidden.

## Idempotency and recovery

The marker is `momi-issue-triage:v1 issue=<number>`. First run creates one
structured comment; rerun updates that comment and reapplies the same configured
label without duplication. Multiple markers fail closed.

Only `issues.opened` and bounded `workflow_dispatch` trigger the workflow.
Invalid output, nonexistent references, unavailable labels, or model failure
causes no mutation. Inspect the exact failed job, correct the source defect, and
dispatch once. Cost remains one mapped low-cost call over capped context.
