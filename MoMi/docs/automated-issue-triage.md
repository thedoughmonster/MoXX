# Automated issue triage (historical source reference)

This document describes an imported source-repository workflow that is inactive
in MoXX. Linear is the sole current work-item authority; no active root workflow
ingests or mutates GitHub Issues.

`.github/workflows/issue-triage.yml` produces one bounded triage record for each
new issue and supports explicit manual re-triage.

## Authority split

The model job has read-only repository/issue authority and no write token. Issue
text is untrusted. It sends only the generated bounded context and contract to
the model-execution gateway, which selects the provider mapping and records
safe operational metadata. The job emits schema-constrained JSON.

The writer is a separate job with issue-write authority and no model-gateway
credential. Before mutation it refetches the current open issue and verifies
issuer declarations, related open issue existence/type, configured labels, safe
text, and one idempotency marker.

## Authoritative contract

`.github/codex/issue-triage.config.json` configures labels by issue type.
The schema, runtime validator, prompt, and focused fixtures deterministically
check parity with that configuration.

Both `bug` and `feature` records retain one owning feature identity and the same
typed dependency graph. Relationship types are hard prerequisite, ordering
constraint, shared mutation/release boundary, external/user gate, and
independent. Direction is `current_before_related`, `current_after_related`, or
`not_applicable`. Hard prerequisites require current-after; ordering constraints
require current-before or current-after; all other types require not-applicable.
Labels are not relationship evidence. Safe rationale punctuation includes issue
references such as `#109`; markup, mentions, and credential-shaped data remain
forbidden.

## Issuer-declared relationships

Issue-authoring agents may place one declaration anywhere in the complete issue
body. Put it early enough for human review even though parsing is not limited by
the model-context body truncation:

```text
<!-- momi-issue-relationships:v1
{
  "schema_version": 1,
  "issue_number": 200,
  "relationships": [
    {
      "issue_number": 199,
      "type": "ordering_constraint",
      "direction": "current_before_related",
      "rationale": "This P0 slice lands before the remaining issue 199 implementation."
    }
  ]
}
-->
```

The declaration permits at most eight unique related issue numbers. Duplicate
markers or references, malformed JSON, mismatched current issue numbers, unsafe
text, unsupported fields/values, or incompatible type/direction pairs fail
closed before a model call or issue write.

Declarations enter model context separately from truncated prose. The model may
infer only undeclared issue numbers. Immediately before mutation, the writer
parses the latest body again, replaces any conflicting or omitted model record
with issuer-owned data, validates all final references, caps the final graph at
eight, and derives safe-parallel status from the final graph. Rendered records
identify `issuer-declared` or `model-inferred` authority and explicit direction.

## Issuer-declared issue type

Issue-authoring agents may bind semantic classification with one bounded block:

```text
<!-- momi-issue-classification:v1
{"schema_version":1,"issue_number":219,"issue_type":"feature"}
-->
```

Only `bug` and `feature` are supported. The complete body is parsed before model
context truncation and again immediately before mutation. Duplicate markers,
malformed or oversized JSON, unknown fields, unsupported values, versions, or a
mismatched issue number fail closed. A valid declaration overrides model output
and selects the configured managed label; undeclared issues retain bounded model
inference. The rendered triage record identifies the authority source.

## Idempotency and recovery

The marker is `momi-issue-triage:v1 issue=<number>`. First run creates one
structured comment; rerun updates that comment and reapplies the same configured
label without duplication. The exact-label write removes the opposing managed
type and the pending label while preserving unrelated labels. Multiple markers
fail closed.

Only `issues.opened` and bounded `workflow_dispatch` trigger the workflow.
Invalid output, nonexistent references, unavailable labels, or model failure
causes no mutation. Inspect the exact failed job, correct the source defect, and
dispatch once. Cost remains one mapped low-cost call over capped context.
