# Architecture Snapshot Identity v2

## Purpose

Architecture Snapshot Identity v2 names the exact committed MoMi source after
the MoXX repository cutover. It supersedes v1 for current-source production; v1
remains immutable historical source-repository evidence.

## Identity

The identity contains the schema identifier and version, repository
`thedoughmonster/MoXX`, authoritative branch `dev`, product path `MoMi`, the
full lowercase commit SHA, the accepted manifest schema identities, and
architecture-contract version 2. The product path distinguishes the backend
source inside the monorepo without changing service-relative manifest paths.

The digest remains lowercase SHA-256 over canonical JSON for the entire
identity, including `$schema`, with no trailing newline.

## Production preconditions

Production fails closed unless the checkout is clean, the normalized origin is
exactly `thedoughmonster/MoXX`, `workspace.json` and the symbolic branch both
name `dev`, and `origin/dev` exists. `HEAD` must be an ancestor of that
authoritative ref. The producer does not fetch or mutate refs.

## Compatibility

Function Capability Model v1 and Service Dependency Graph v1 keep their existing
shapes and semantics while embedding the complete v2 source snapshot. Changing
the identity shape, repository, path, schema, or canonical encoding requires a
later identity version. Changing architecture interpretation still requires an
architecture-contract version bump.
