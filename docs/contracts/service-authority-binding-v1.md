# Service Authority Binding v1

## Status and boundary

This document and `schemas/service-authority-binding-v1.schema.json` define the
normative `service-authority-binding/v1` reference bundle. The bundle reconciles
four existing sources at one pinned repository revision. It creates no owner,
permission, debt exception, hosted-state attestation, or execution grant.
The binding is migration-free. Existing service manifests, the removal-only
debt baseline, and Execution Authority v1 remain authoritative in their own
domains. No binding is valid merely because it names those sources.
## Four non-overlapping layers

| Layer | Authoritative source | Meaning | Positive effect |
| --- | --- | --- | --- |
| Target authority | `services/<service>/service.json#/owned_dataset`, ADR 0013, and ADR 0014 | Intended owner, private objects, and public contract boundary | Ownership only |
| Declared runtime compatibility | `services/<service>/service.json#/database` | Repository-declared access envelope expected by current code, not hosted role/grant state | None |
| Legacy debt | Exact fingerprints in `docs/service-access-debt-baseline.json` | Removal-only evidence of known contradiction or transitional direct access | None; diagnose or subtract only |
| Execution authority | Validated `execution-authority/v1` identity and declaration digest | Exact issue-scoped worker grant | Only the independently reviewed subset |

Runtime compatibility never creates target ownership. Legacy debt never grants
access and is never copied into positive authority. Execution Authority v1 is
the only positive worker grant, and its `legacy_debt.targets` remains negative
provenance rather than permission.
## Binding shape and digests

Identity is `schema_version`, `repository`, exact 40-character `revision`, and
`service`. `binding_digest` is SHA-256 of canonical JSON after removing
`$schema` and `binding_digest`.
`target_authority` is either `null` or a manifest reference with the exact
source path, `/owned_dataset` JSON pointer, `service-manifest/v1`, and a
SHA-256 digest of that canonical JSON value. `null` is required when the
service has no `owned_dataset`; the resolver still reads the manifest to prove
absence.
`runtime_compatibility` has the same reference shape but must point to
`/database`. Its value digest binds the complete declared `read` and `write`
envelope. It cannot be used as the target reference.
`legacy_debt` must name the canonical baseline path, schema ID,
`service-access-debt-baseline/v1`, the SHA-256 of the complete UTF-8 source,
and the sorted exact set of fingerprints applicable to the service. It never
contains a finding, target, summary, evidence body, or replacement permission.
`execution_authority` is `null` for zero worker authority. Otherwise it names
only `work_item`, `grant_id`, `base_revision`, accepted `source_digest`, and the
canonical Execution Authority v1 declaration digest. The declaration itself is
resolved from the indexed source and revalidated with independently supplied
issue trust; the binding cannot attest its own grant.

Bindings contain no `owned_dataset`, `database`, finding bodies, debt targets,
summaries, positive authority collections, credentials, secrets, or payloads.

## Resolution and precedence

The resolver indexes the bounded repository corpus once, validates every source
against its own schema, and then checks each binding in this order:

1. Strict binding schema, repository, trusted revision, and binding digest.
2. Exact service path, pointer, source version, target presence, and target and
   runtime canonical-value digests.
3. Exact debt source identity and full-source digest, followed by exact sorted
   fingerprint reconciliation for the service.
4. Exact Execution Authority v1 identity and declaration digest, followed by
   its existing fail-closed validation against target ownership, declared
   runtime compatibility, public-contract law, prohibitions, debt, and separate
   issue trust.

Requested work is bounded subtractively by issue authority, repository law,
target authority, declared compatibility, prohibitions, and debt. Weaker layers
are never unioned. Missing or copied sources, stale revisions or digests,
runtime-as-owner references, debt-derived authority, new or unrecognized debt,
execution widening, contradiction, and ambiguity all fail closed.

Diagnostics sort by service, layer, source path, pointer, code, and target or
fingerprint. They expose source identities only, never secret values or payloads.

Repository architecture validation scans `service-authority-bindings/*.json`
when that directory exists. An absent directory creates no implicit binding or
authority. The canonical check supplies no revision or execution trust, so a
repository binding cannot self-authorize; a reviewed caller must supply the
exact trusted revision and issue-scoped Execution Authority context.

## Legal transitions

| Change | Result |
| --- | --- |
| Target owner, object, or contract changes | Follow ADR and trusted-`dev` manifest sequencing; runtime, debt, and execution do not change automatically |
| Runtime compatibility narrows | Allowed when code and contracts remain valid; repaired debt is removed by its owning remediation |
| Runtime compatibility expands within owned or public-contract bounds | Architecture-compatible only; grants no worker permission |
| Runtime adds a private cross-owner target | Reject; new debt is forbidden |
| A repaired debt finding disappears | Remove its exact fingerprint; never rewrite or restore it |
| A debt finding appears or its fingerprint changes | Reject and stop; do not baseline it as permission |
| An execution grant changes | Require its own reviewed decision, base/source identity, and complete revalidation |
| Hosted roles or grants differ | Record constraining drift and stop or repair; never mutate target authority from observation |

A breaking reference-shape or semantic change requires
`service-authority-binding/v2`. Ordinary source content changes retain v1 but
require a new pinned revision and recomputed source, declaration, and binding
digests.

## Representative traces

- `preorder-operations` owns exact `momi_preorder.*` objects. Its declared write
  compatibility also includes `momi_communications`, which creates no ownership.
- `toast-order-ingest` has no target dataset, declares broad database writes,
  and references two exact removal-only direct-write findings. Neither source
  grants worker authority.
- `order-alerting` owns a bounded object set, declares reads across six schemas,
  and has 23 exact debt findings. The broad envelope and debt remain constraints.

## Verification and non-goals

Focused tests cover owner, no-dataset, no-debt, debt-referenced, zero-execution,
and exact-execution cases plus copied bodies, stale identities, missing sources,
runtime-as-owner, debt-derived authority, unrecognized fingerprints, and
execution widening. Run `pnpm architecture:check` and the repository-selected
focused check while iterating; PR CI owns the one `validate-final` gate.

V1 does not migrate manifests, redesign exact database-object authority,
rebaseline debt, create grants or packets, alter ownership or public contracts,
change roles or hosted access, deploy code, or perform provider, credential,
runtime, production, restoration, destructive, or external-configuration work.
