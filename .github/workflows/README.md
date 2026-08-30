# Workflow authority

GitHub activates workflow files only from this root directory. The imported
`MoMi/.github/workflows/` and `MoXi/.github/workflows/` directories are retained
as source-history reference material and are not execution authorities in MoXX.

Root workflows route product commands through `MoMi/` or `MoXi/` explicitly.
Backend deployment apply remains limited to `deploy-dev.yml` and
`deploy-prod.yml`; UI deployment remains limited to the two Cloudflare workflows.
Secret values are never stored here: workflows reference repository or
environment secrets by name.
`cloudflare-credential-preflight.yml` and
`supabase-credential-preflight.yml` are read-only provider metadata checks.
They validate credential authority without invoking deployment, database access
renewal, or provider mutation.

The Supabase preflight binds each environment to its canonical project. For
production it also reads the current token-to-database mapping and succeeds only
when the existing `postgres` mapping has no expiry. It emits booleans and target
identity only; it never emits the provider user, network restrictions, or token.
MoXX has no scheduled database-access renewal workflow. MOX-409 authorizes the
non-scheduled production model documented in
`MoMi/docs/release-credentials.md`.

Linear is the sole work-item authority. Root workflows neither ingest nor
mutate GitHub Issues, and no GitHub issue state is a planning or completion
gate. They do not enforce a duplicate delivery ledger through pull-request
metadata. GitHub continues to own branches, commits, pull requests, CI, review
history, and deployments.
