# MoXX repository migration manifest

## Imported source identities (historical)

These repositories and commits are import provenance, not current execution
authority. MoXX is the sole active product repository after MOX-390.

| Product | Repository | Branch | Accepted commit | Source tree |
| --- | --- | --- | --- | --- |
| MoMi development | `thedoughmonster/momi-backend` | `dev` | `f52215975104aa8448f9cad4a05945ffe8282b46` | `83f55e25bb900c3e1af07ca0b001829fc0ac860c` |
| MoMi production | `thedoughmonster/momi-backend` | `prod` | `9b2addfcbb99c8f5d83276b4d6475d302b4c8de6` | `1e33cf6dfa611df3cc5edbf99a1f061e54d0ddb2` |
| MoXi accepted main | `thedoughmonster/moxi-web` | `main` | `74279ef82c4759c50021eba5bccb8d21f2749978` | `156c927369fe17efbf870890824e2b0e10b8556b` |
| MoXi readiness branch | `thedoughmonster/moxi-web` | `mox-348-centralize-ui-readiness` | `398b6622cb391be1d48a95b5320cc61cd3074c4d` | `fdb6483523336ea2d2f1a005c708883eb31870bc` |

Remote refs were verified on 2026-08-25 before import. Full mirrors were used
because the Symphony workspaces are shallow clones. Imports were performed
without `--squash`.

## Target branches

| MoXX branch | Import commit | MoMi subtree | MoXi subtree |
| --- | --- | --- | --- |
| `dev` | `8d124b9cc1bab02639bd5a82fcdce5702c28e552` | exact MoMi `dev` tree | exact MoXi `main` tree |
| `prod` | `3e6a4f2c1a896c69998f6a658f2a38225abfbd59` | exact MoMi `prod` tree | exact MoXi `main` tree |
| `mox-348-centralize-ui-readiness` | `508b7fb663579f9257295581c56b2b7735602f6c` | MoMi `dev` tree | exact MoXi readiness-branch tree |

## Verification

The following target/source tree pairs matched exactly:

| Target subtree | Target tree | Source tree | Result |
| --- | --- | --- | --- |
| `dev:MoMi` | `83f55e25bb900c3e1af07ca0b001829fc0ac860c` | `83f55e25bb900c3e1af07ca0b001829fc0ac860c` | Match |
| `dev:MoXi` | `156c927369fe17efbf870890824e2b0e10b8556b` | `156c927369fe17efbf870890824e2b0e10b8556b` | Match |
| `prod:MoMi` | `1e33cf6dfa611df3cc5edbf99a1f061e54d0ddb2` | `1e33cf6dfa611df3cc5edbf99a1f061e54d0ddb2` | Match |
| `prod:MoXi` | `156c927369fe17efbf870890824e2b0e10b8556b` | `156c927369fe17efbf870890824e2b0e10b8556b` | Match |
| `mox-348-centralize-ui-readiness:MoXi` | `fdb6483523336ea2d2f1a005c708883eb31870bc` | `fdb6483523336ea2d2f1a005c708883eb31870bc` | Match |

The accepted MoMi development and MoXi main commits are ancestors of the MoXX
`dev` import commit. The accepted MoMi production commit is an ancestor of the
MoXX `prod` import commit.

## Import-time mutation record

- Created only `/home/ubuntu/MoXX` and temporary read-only source mirrors.
- Did not change source branches, tags, remotes, worktrees, repository settings,
  deployments, or provider configuration.
- Did not create or push the MoXX GitHub remote.
- Did not restart Symphony.

## Cutover status

The imported history remains intact. MOX-388, MOX-389, and MOX-392 established
the automation, validation, remote, and mapping prerequisites. MOX-390 completed
the authority cutover at `2026-08-30T14:04:01Z`; the accepted source tombstones
and final MoXX commits are recorded in `mox-390-cutover-receipt.md`.
