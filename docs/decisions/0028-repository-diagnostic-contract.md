# 0028: Repository-owned deterministic diagnostics

- Status: accepted
- Date: 2026-08-23

## Context

Source-quality, architecture/ownership, manifest, migration, Edge Function,
and generated-artifact checks are stable consumers of richer deterministic
failure output. Shared repository code requires an explicit owner and decision,
but each check must remain the authority for its own rules and enforcement.

## Decision

Non-deployable repository validation tooling owns one versioned diagnostic
shape and one human renderer. Producers reuse current rule identities,
`hard_stop`/`advisory` enforcement, validation commands, and canonical identity
facts. They explicitly distinguish an exact deterministic command from no safe
deterministic repair. The renderer groups and redacts data; it does not execute
commands or decide pass, fail, warning, or exit status.

## Consequences

Planned check-family adopters share a compact agent-facing representation
without creating a rule registry, policy engine, service, database, or second
validation stage. Checks without repository-known remediation may keep their
native diagnostics.
