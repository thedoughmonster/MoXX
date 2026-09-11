# MOX-390 final repository cutover receipt

## Authority decision

MoXX became the sole active product repository at `2026-08-30T14:04:01Z`, when
the last obsolete source scheduler was disabled after replacement and
production-equivalence proof. The private source repositories remain readable
and retain all branches, tags, releases, issues, pull requests, and audit
history, but their merged tombstones and retired governing instructions make
them non-authoritative.

## Frozen inventory

The access-controlled inventory was frozen on 2026-08-25 between 16:51:57Z and
16:52:19Z. Item-level private metadata remains access-controlled and is
referenced by the Linear workpad. This public receipt publishes only aggregate
counts and accepted commit identifiers approved for the public record.

| Class | Total | Disposition |
| --- | ---: | --- |
| Remote branches | 230 (217 MoMi, 13 MoXi) | Classified once and retained; no branch or history was deleted |
| Open pull requests | 15 (11 MoMi, 4 MoXi) | Classified once and explicitly dispositioned with retained provenance |
| Workflows | 12 (7 MoMi, 5 MoXi) | Classified once; obsolete source execution paths are disabled after equivalence proof |
| Local source workspaces | 23 | Classified once and retained as read-only evidence; active execution routes to MoXX |
| GitHub issues | 429 | Retained as read-only planning and audit history |
| Deployments | 176 | Retained as immutable provider history |

Each inventory row appears in exactly one class and has exactly one disposition.
No secret value, webhook configuration, provider payload, or private key is in
this repository.

## Active repository mapping

| Product role | Authoritative target | Branch |
| --- | --- | --- |
| Development and pull requests | `thedoughmonster/MoXX` | `dev` |
| Production release history | `thedoughmonster/MoXX` | `prod` |
| Backend subtree | `thedoughmonster/MoXX` | `MoMi/` |
| UI subtree | `thedoughmonster/MoXX` | `MoXi/` |

This is the sole active product mapping. The imported source commits and exact
source/target trees remain recorded in
[`repository-migration-manifest.md`](repository-migration-manifest.md). Source
tombstones point here, the Symphony execution boundary names this repository,
and Linear remains the sole work-item authority.

## Accepted commits

| Role | Commit |
| --- | --- |
| MoXX repository-authority establishment | `8c54fb0c651718b4b563142a67642df3493c53cf` |
| MoXX accepted `dev` and protected `prod` at final proof | `bc7b469c64270ccc878ce8ae22d5152b599b1c07` |
| MoMi source tombstone and operator retirement | `d4c8ef79c5da6bd85bbc3d591a7999394267a110` |
| MoMi final non-authoritative instructions | `ffad94ff15436cfd452f048a87ea09cc49aa0419` |
| MoMi final source authority record | `f3e45b3ddedcd3c5ff7ee2f2de14a2d69aed2795` |
| MoXi source tombstone | `89486f572b1c142db42903bbdf71cb19924bda08` |
| MoXi final non-authoritative instructions | `3ffaff1a0c7fd1e4cb50db34ba13246820047e46` |

## Equivalence gate

The `cutover-equivalence.yml` pull-request workflow proves the candidate HEAD
without provider mutation:

- the backend release planner computes a bounded plan against `origin/dev`;
- Wrangler builds both preview and production Workers with `--dry-run`;
- the receipt and root workflow-authority invariants pass;
- ordinary MoMi and MoXi validation remain independently path-routed.

Architecture Snapshot Identity v2 pins current backend models to
`thedoughmonster/MoXX`, `dev`, and product path `MoMi`; the immutable v1 source
identity remains historical evidence. Active architecture builders, inspectors,
and authority contexts no longer accept the retired source repository as the
current mapping.

Immutable Execution Authority v1 fixtures still name source-era commits as
historical provenance. MoXX contains no active `execution-authorities/`
declarations; any future declaration requires a separately versioned MoXX
identity rather than reinterpretation of those retained v1 records.

The source workflows were disabled only after these exact-head checks passed.
Post-disable protected-production preflight run `33315868802` succeeded at
exact `prod@bc7b469c64270ccc878ce8ae22d5152b599b1c07`. It proved, without
printing credentials or provider payloads, that the permanent production
database mapping and exact target metadata remained readable. MoXX registers
no renewal scheduler. Retained source validation history is not a deployment or
product-authority path.

## Proof-only rollback drill

The operator-authorized drill was read-only. It resolved both tombstone commits,
the later source-instruction commits, their parents, inverse documentation
patches, and the workflow files at the prior accepted commits without
re-enabling a workflow, changing a mapping, removing a tombstone, or mutating
provider state.

| Evidence | SHA-256 or object identity |
| --- | --- |
| MoMi tombstone parent | `9a60bedee0f881965f7fa0284c013a33d1ce1b90` |
| MoMi inverse README patch | `0dfdda749b5a1bfae908d31985868b78fa82ed053f657764e0e1b4f30500995d` |
| MoMi final-instruction inverse patch set | `a34cbb91ece0b37b00c5f7969e20d5359dfc47f307c55b0e58406f69f4675223` |
| MoMi final-reference inverse patch set | `8899ff6e4cbfcae9df9d581c35193de88a3733dc751c521daf4bf00bc78cbd60` |
| MoMi prior workflow manifest | `9791a7676fe956fb49af6c6ba7bf87ac1f04a377795366563f1013d6c604379d` |
| MoXi tombstone parent | `74279ef82c4759c50021eba5bccb8d21f2749978` |
| MoXi inverse README patch | `9bf8abf5ed4ff7ee101595c6ec2e959c33d15b0bf59f06df5638868e9be4038e` |
| MoXi final-instruction inverse patch set | `0d569b622ab54160ab8cbff01803fee6d48bbf4f7f88d921110e91db28ee6974` |
| MoXi prior workflow manifest | `3e996c72b16e99b08fb08bd7b41adf9b25f23e91167877d79aff0c8b2d571e9f` |

In a separately authorized rollback window, operators would create normal
branches from the current source heads and revert the recorded instruction and
tombstone commits in reverse order through reviewed pull requests. They would
then restore the
recorded source workflow IDs with GitHub's workflow-enable API and restore the
recorded MoMi `dev`/MoXi `main` execution mapping. Reapplying the cutover is the
inverse: merge the recorded tombstones, restore the MoXX mapping, and disable
the same source workflows after equivalence proof. Exact private workflow IDs
and copy-ready commands are in the access-controlled Linear workpad. No history
rewrite or data restoration is required because no repository object was
deleted.
