# Architecture Snapshot Identity v1

## Purpose

Architecture Snapshot Identity v1 names the exact committed repository source
used by an architecture graph, compiled model, or execution packet. A mutable
branch name is not an identity. Consumers carry the complete `source_snapshot`
pair and use the repository assertion API; they do not select fields or define
another encoding.

## Identity

The identity contains only:

- the schema identifier and schema version;
- repository `thedoughmonster/momi-backend` and authoritative branch `dev`;
- the full lowercase 40-character commit SHA;
- the service-manifest and function-manifest schema identifiers and v1 versions;
- architecture-contract version 1.

The digest is lowercase SHA-256 over the existing `canonicalJson` UTF-8 output
for the entire identity, including `$schema`, with no trailing newline. It is
stored beside the identity, never inside it, so there is no circular field.

## Production preconditions

Production fails closed unless the checkout is clean, including staged,
unstaged, and untracked files. The configured origin must normalize exactly to
the repository above, `workspace.json` and the current symbolic branch must both
be `dev`, and `origin/dev` must exist. Detached checkouts are rejected. `HEAD`
must be an ancestor of the local authoritative ref. The producer does not fetch
or mutate refs. Both manifest schema identifiers and accepted v1 identities
must match the committed files.

## Validation and diagnostics

The identity schema rejects missing fields, unknown fields, abbreviated or
uppercase SHAs, branch-only input, and unsupported versions. The assertion API
strict-validates the supplied `{ identity, digest }`, rebuilds the actual pair,
and reports deterministic diagnostics containing a code, field path, expected
value, and actual value. Diagnostics sort by path, code, expected value, and
actual value.

Changing the identity shape, schema, or canonical encoding requires a new
schema version. Changing the interpretation of workspace, service, or function
architecture requires a new architecture-contract version. Dirty state,
timestamps, hosts, users, agents, runs, reviews, and receipts are deliberately
not representable.
