# MOX-392 publication receipt

Status: in progress; public publication authorized

## Identity

- Execution branch: `mox-392-publish-remote`
- Accepted monorepo tip: `4ada2c9b2d4d19aa2627165cc5c6f1277e5284d9`
- Accepted production import: `3e6a4f2c1a896c69998f6a658f2a38225abfbd59`
- Accepted MOX-348 branch: `508b7fb663579f9257295581c56b2b7735602f6c`
- Linear blocker MOX-389: Done

## Verified preconditions

- GitHub CLI authentication was renewed through GitHub's device flow without
  printing or copying the credential into the repository, receipt, or Linear.
- `gh auth status` verifies the active `thedoughmonster` account, SSH Git
  protocol, and `repo` plus `read:org` scopes.
- `thedoughmonster/MoXX` does not exist. The local MoXX repository has no
  remote, so repository creation would not overwrite competing history.
- Source repositories are private. Their settings, branches, credentials, and
  contents were inspected read-only and were not changed.
- The required environment and credential names were inventoried without
  reading credential values.

## Visibility authorization

MOX-392 requires protected `dev` and `prod` branches and direct evidence that
unauthorized pushes fail. The current GitHub account cannot enable either
native protection mechanism for a private repository:

- Classic branch-protection reads on the existing private MoMi `dev` and
  `prod` branches and MoXi `main` branch return HTTP 403:
  `Upgrade to GitHub Pro or make this repository public to enable this feature.`
- Repository-ruleset reads on both existing private source repositories return
  the same HTTP 403 and upgrade requirement.
- The authenticated account belongs to no organization whose plan could own
  the repository with different private-repository governance capability.

The operator then explicitly authorized making `thedoughmonster/MoXX` public
if that enables the required native protections. This amends MOX-392's original
private-visibility constraint for this repository only; it does not authorize
changing either source repository's visibility or settings.

## Public-disclosure audit

- Official Gitleaks `8.30.1` was downloaded from `gitleaks/gitleaks`; its Linux
  x64 archive matched the publisher's checksum before execution.
- A redacted scan covered all reachable refs and reported 80 candidates across
  438 commits and approximately 8.91 MB of patches.
- All candidates were classified without publishing their values: 2 are
  deliberately malformed PEM markers in a credential-redaction test, 2 are
  64-character `manifest_sha256` digests, and the remaining candidates are
  internal function/policy identifiers, cron keys, or test UUIDs.
- Neither malformed PEM marker parses as a private key. No candidate matches a
  known provider-token prefix or JWT shape.
- A history-wide sensitive-filename inventory found only `.env.example` files;
  no tracked `.env`, private key, certificate, keystore, credential, or secret
  data file was found.
- The public-disclosure audit therefore found no credential requiring history
  rewrite or rotation before publication. Imported history remains unchanged.

## Mutations and non-mutations

- Renewed the existing host GitHub CLI authentication as `thedoughmonster`.
- Created only the local execution branch `mox-392-publish-remote`.
- Did not create `thedoughmonster/MoXX`.
- Did not add a Git remote or push any branch or tag.
- Did not move local `dev`, `prod`, or the ported MOX-348 branch.
- Did not create environments, variables, secrets, rules, or branch settings.
- Did not change either source repository or any provider.
- Did not change Symphony repository mappings or restart Symphony.

## Next publication actions

Join the accepted production import into the development publication ancestry
without changing the accepted dev or prod product trees, create the public
repository without initialization, publish only the authorized refs, then
enable and directly verify native branch protections before any mapping cutover.
