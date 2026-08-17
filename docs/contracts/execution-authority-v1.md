# Execution Authority v1

## Status and ownership

This document and `schemas/execution-authority-v1.schema.json` define the normative Execution Authority v1 declaration. A declaration is a separate, issue-scoped positive grant. Service manifests, architectural ownership, observed runtime access, and legacy debt never grant worker permission; they only constrain a declaration or produce diagnostics.

The reviewed declaration is authoritative. A future execution packet may contain only a digest-bound, non-widening projection. Packet generation is outside this contract.

## Identity and fail-closed rule

Identity is `schema_version`, `grant_id`, `work_item`, `service`, `repository`, exact 40-character Git `base_revision`, and 64-character SHA-256 `source_digest`. `source_digest` binds the accepted decision in `provenance.accepted_decisions`. Unknown fields, unsupported versions, missing provenance, base or digest drift, ambiguity, and contradictions fail closed. No weaker source is unioned into a grant and no permissive fallback exists.

Every collection is required, unique, canonically sorted by its JSON representation, and may be empty. Diagnostics are sorted by `grant_id`, field path, code, and target.

## Positive authority

- `filesystem.read` and `filesystem.write` contain normalized repository-relative files or explicit directory bounds. Directory recursion is explicit. Read and write do not imply each other. Absolute paths, traversal, globs, backslashes, missing targets, kind mismatches, and symlink escape are invalid.
- `database.read` and `database.write` name the exact owning service, object kind, and qualified object. A schema-wide grant requires an explicit reviewed schema entry. A private cross-owner object and an object present only in legacy debt are invalid.
- `contracts.call` names the exact provider service and versioned public contract. It grants no provider implementation, database, network, secret, package, credential, external action, or transitive effect.
- `network.connect` names an exact protocol, host, and port. Wildcards, embedded credentials, and undeclared redirects are invalid.
- `secrets.reference` contains names only. It never grants disclosure, value capture, export, rotation, or ownership.
- `packages.use` contains exact repository-approved package coordinates.
- `external.invoke` contains an exact accepted external-authority key, operation, and resource. A host, secret, or contract cannot imply it.

A valid zero-authority declaration has every positive collection empty while retaining identity, provenance, prohibitions, and escalation rules. A contract-only declaration can contain one `contracts.call` entry while every direct filesystem-write, database, network, secret, package, and external collection stays empty.

## Negative authority and escalation

`forbidden` explicitly records paths, services, database objects, contracts, hosts, secret names, external actions, and operation classes. Deny wins and narrower scope wins. At minimum, deployment, destructive, production, restoration, and runtime operations remain forbidden unless a separate exact authority is accepted.

`escalate_on` records mandatory stop classes. V1 requires all schema-listed classes, including drift, path escape, manifest or contract mismatch, cross-owner and debt-derived targets, provider leakage, missing external authority, secret values, allow/deny overlap, protected operations, ambiguity, and unknown version.

## Provenance and precedence

1. `provenance.issue_authorization` and accepted decisions set the requested ceiling.
2. Repository rules, service rules, ADRs, and public-contract law constrain it.
3. Service manifests and contracts constrain architecture and runtime compatibility.
4. Execution Authority v1 selects the exact permitted subset.
5. Runtime observations and legacy debt may only reduce authority or raise diagnostics.

`runtime_observations` and `legacy_debt` are negative/context evidence only. `legacy_debt.targets` can never appear in positive database authority. A prohibition, contradiction, missing source, or ambiguity always stops for the named owner decision.

## Deterministic validation

Validation performs strict Draft 2020-12 schema validation, recursive sorting and uniqueness checks, exact repository/base/digest checks, revision-rooted path and symlink resolution, manifest upper-bound checks, provider/contract existence checks, external-authority lookup, debt and cross-owner rejection, allow/deny scanning, required escalation/protection checks, and sorted diagnostic emission. After validation succeeds, consumers compute the SHA-256 of canonical JSON with `$schema` and `source_digest` omitted, avoiding circular identity while binding every authority field.

Repository architecture validation scans `execution-authorities/*.json` when that directory exists. An absent directory means no grants, not implicit authority. The repository scan requires a separately supplied, issue-keyed trust context for every declaration; it never derives the expected base, accepted source digest, or external authority from the declaration being checked. A missing trust entry fails closed. External authority is supplied as a structured `{authority_key, operation, resource}` tuple; provenance source labels are evidence identifiers, not parsed authority. Validation indexes declarations once and never infers permission by repeatedly scanning runtime state.

## Boundaries

V1 does not migrate service manifests, alter runtime/database/network/secret access, create authority, deploy code, touch production, or build the execution-packet generator. Ownership, public-contract, security, provider, credential, and external-authority changes require their own accepted decision.
