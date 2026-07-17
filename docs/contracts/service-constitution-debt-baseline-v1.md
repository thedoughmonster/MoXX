# Service Constitution Debt Baseline v1

`docs/service-constitution-debt-baseline.json` is the removal-only bootstrap
allowance for the 12 service manifests that predate ADR `0013`. Its schema is
`schemas/service-constitution-debt-baseline-v1.schema.json`.

## Scope

Version 1 accepts only `service_type_missing` for the 12 paths already recorded
at the constitution cutoff. A new service or a different rule cannot be added.
Future temporary exceptions require their own explicit, expiring contract.

## Identity

Each entry records:

- `rule_version` and `rule_id`;
- a stable repository-relative `subject`;
- sorted, stable `evidence` such as the service key;
- a SHA-256 `fingerprint` of those identity fields;
- a diagnostic `summary`.

The summary and source line are deliberately excluded from the fingerprint, so
wording or line movement cannot churn an exemption. The checker recomputes
every fingerprint and rejects malformed, duplicate, or out-of-order entries.

## Ratchet

The current finding set and baseline must match exactly. A new finding fails.
A resolved baseline entry is stale and also fails, forcing its removal in the
same change that fixes the declaration. The checker also compares canonical
fingerprints with `origin/dev`; identities may be removed but never changed or
re-added. If a finding later recurs, restoring its old exemption fails as well
as the recurring debt.

Run `pnpm constitution:check`. Findings are printed in deterministic order for
the required pre-merge architecture review; no generated report is written.
