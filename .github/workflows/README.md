# Workflow authority

GitHub activates workflow files only from this root directory. The imported
`MoMi/.github/workflows/` and `MoXi/.github/workflows/` directories are retained
as source-history reference material and are not execution authorities in MoXX.

Root workflows route product commands through `MoMi/` or `MoXi/` explicitly.
Backend deployment apply remains limited to `deploy-dev.yml` and
`deploy-prod.yml`; UI deployment remains limited to the two Cloudflare workflows.
Secret values are never stored here: workflows reference repository or
environment secrets by name.

Linear is the sole work-item authority. Root workflows neither ingest nor
mutate GitHub Issues, and no GitHub issue state is a planning or completion
gate. `linear-issue-mapping.yml` only fails closed unless a pull request and its
head branch name the same single Linear identifier. GitHub continues to own
branches, commits, pull requests, CI, review history, and deployments.
