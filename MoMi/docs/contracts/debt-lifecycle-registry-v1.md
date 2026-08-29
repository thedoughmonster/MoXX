# Debt Lifecycle Registry v1

`docs/debt-lifecycle-registry.json` maps every currently accepted service
constitution and runtime-access fingerprint to temporary lifecycle metadata.
The registry references exact fingerprints without copying or redefining the
underlying finding. The baselines remain removal-only and continue to reject
new or churned debt.

## Lifecycle

Each record has one accountable owner, one historical remediation reference, a
risk, temporary reason, introduction/review/expiry dates, removal evidence, and an
append-only review history. High-risk debt is reviewed within 30 days and
expires within 90 days. An overdue review or expiry fails local validation.
Changing metadata requires a new dated review while preserving the complete
trusted-development history.

The current ordered mapping is mechanically fixed: residual runtime-registry
and event-router findings map to #196 (8); remaining alerting or Slack
findings map to #195 (15); the three exact archive/evaluation fingerprints map
to #572; and the remaining POS/warehouse findings map to #194 (61). The order
is significant and partitions all 87 findings exactly once.

A remediation removes the exact baseline fingerprint and registry reference
in the same change that proves the private access is gone. The numeric GitHub
issue references are retained as historical evidence from the accepted v1
record; they are not consulted for current work state. Linear owns active
remediation state.

## Verification

Ordinary checks are deterministic and network-free. They validate the schema,
coverage, uniqueness, ordering, dates, risk, history, trusted-base continuity,
and the generated trend artifact. The trend reports counts and age by issue,
owner, risk, rule, and consumer service, but is not correctness proof.

Validation does not query or mutate any external issue tracker. Repository
checks enforce the registry's schema, dates, append-only history, and exact
fingerprint coverage; current remediation state remains in Linear.
