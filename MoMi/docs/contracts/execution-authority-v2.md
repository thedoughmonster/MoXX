# Execution Authority v2

Execution Authority v2 preserves every v1 identity, filesystem, contract,
network, secret, package, external, prohibition, escalation, provenance, and
validation rule. V1 declarations retain their historical schema-wide database
interpretation and are not reinterpreted.

V2 replaces `database.read` and `database.write` with a pinned
`database.authority` reference and `database.capabilities`. The pin contains
the repository, exact revision, source digest, and authority digest of one
successfully validated `database-object-authority/v1` value. Each capability
contains one structured relation, routine-overload, or future sequence identity
and exactly one compatible mode. A schema identity is invalid, and broad
runtime compatibility never becomes a capability.

An owner may receive exact relation read/write or routine-call authority when
the manifest runtime envelope covers that object or its schema. A cross-owner
relation read or routine call additionally requires one exact public mapping,
the matching consumed contract, and the mapping-kind-selected runtime envelope.
Relation/routine read mappings and dynamic read bindings require
`database.read`; routine command mappings require `database.write`. The
positive routine mode remains `routine.call`. Cross-owner relation write,
missing or mismatched mappings, ambiguity, debt-only targets, sequence targets,
duplicates, class/mode mismatch, and any schema/broad positive grant fail
closed with deterministic database-authority tuples.

Migration ownership, public mapping, runtime compatibility, accepted ADR
classification evidence, and legacy debt never grant a capability. V2 changes
no runtime role, database grant, service manifest, deployment, provider, or
credential state.
