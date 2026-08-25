# MOX-390 repository cutover receipt

## Authority decision

MoXX is the sole active product repository. The private source repositories
remain readable, retain all branches, tags, releases, issues, pull requests,
deployments, and audit history, and are explicitly non-authoritative.

## Frozen inventory

The access-controlled inventory was frozen on 2026-08-25 between 16:51:57Z and
16:52:19Z. Item-level private metadata is retained with the source tombstone
commits and the Linear workpad; this public receipt publishes only aggregate
counts.

| Class | Total | Disposition |
| --- | ---: | --- |
| Remote branches | 230 (217 MoMi, 13 MoXi) | Retained as non-authoritative history; open-PR heads also inherit the PR disposition |
| Open pull requests | 15 (11 MoMi, 4 MoXi) | Explicitly closed as superseded by MoXX after item-level review |
| Workflows | 12 (7 MoMi, 5 MoXi) | Source workflows disabled after MoXX equivalence proof |
| Local source workspaces | 23 | Mappings changed to MoXX; no workspace was deleted |
| GitHub issues | 429 | Retained as read-only planning and audit history |
| Deployments | 176 | Retained as immutable provider history |

Each inventory row appears in exactly one class and has exactly one disposition.
No secret value, webhook configuration, provider payload, or private key is in
this repository.

## Accepted repository mapping

| Product role | Active repository | Branch |
| --- | --- | --- |
| Development and pull requests | `thedoughmonster/MoXX` | `dev` |
| Production release history | `thedoughmonster/MoXX` | `prod` |
| Backend subtree | `thedoughmonster/MoXX` | `MoMi/` |
| UI subtree | `thedoughmonster/MoXX` | `MoXi/` |

The imported source commits and exact source/target trees remain recorded in
[`repository-migration-manifest.md`](repository-migration-manifest.md). Source
tombstone and final MoXX commits are recorded in the Linear workpad after the
protected merges complete.

## Equivalence gate

The `cutover-equivalence.yml` pull-request workflow proves the candidate HEAD
without provider mutation:

- the backend release planner computes a bounded plan against `origin/dev`;
- Wrangler builds both preview and production Workers with `--dry-run`;
- the receipt and root workflow-authority invariants pass;
- ordinary MoMi and MoXi validation remain independently path-routed.

Only after these exact-head checks pass may source workflows be disabled.

## Rollback drill

The drill is intentionally mapping-only and never rewrites history:

1. Record the current MoXX, MoMi-source, and MoXi-source accepted commits.
2. Re-enable the source workflow IDs recorded in the private inventory.
3. Restore each operator mapping to the recorded source repository and branch.
4. Remove the source README tombstones by reverting their tombstone commits.
5. Verify the prior workflows resolve from their recorded commits.
6. Reapply the tombstone commits and disable the source workflows again.
7. Verify MoXX mappings and workflow registration are restored.

The execution workpad records the non-mutating command evidence and cutover
timestamp. No data restoration is required because no repository object is
deleted.
