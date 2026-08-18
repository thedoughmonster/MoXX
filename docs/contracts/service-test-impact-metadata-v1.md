# Service Test Impact Metadata v1

This contract lets a coordinator select tests from service declarations without
inferring meaning from repository layout. It does not replace the current test
runner or change worker authority.

## Manifest Shape

`services/<service-key>/service.json` may declare `test_impact` with
`schema_version: 1`, a matching `owner_service`, and all seven category arrays:

- `local_unit`
- `local_integration`
- `provider_contract`
- `consumer_contract`
- `cross_service_integration`
- `mandatory_global`
- `risk_triggered`

An empty array is an explicit empty declaration. An absent field remains valid
during staged adoption and consumers report `metadata_absent`. Present-but-
invalid metadata never falls back to inference.

Every selector contains exactly `id`, `test`, `reason`, `services`, `contracts`,
and `triggers`. IDs are globally unique and use
`<owner>:<category>:<stable-slug>:vN`. `test` is one normalized repository-
relative regular `.test.ts` file. Globs, directories, absolute paths, traversal,
backslashes, `node_modules`, missing files, and symlink escape are rejected.

Services, contract references, triggers, and selectors use unique UTF-16 order.
Contracts contain exactly `provider_service` and a versioned contract key.
Triggers use the existing impact classes: architecture, docs, issue automation,
manifest, migration, repository tooling, runtime, unknown, and workflow.

## Category Rules

Local unit and integration selectors name only their owner and no contracts.
Provider selectors reference contracts their owner provides. Consumer selectors
reference exact tuples their owner consumes. Cross-service selectors name at
least two services and a declared dependency connecting them. Non-risk selectors
have no triggers; risk selectors have at least one.

For any non-empty impact involving a service, resolution selects its non-risk
selectors. Risk selectors are added when any trigger matches. Exact test paths
sort by the repository UTF-16 comparator and execute once; every reason survives,
sorted by owner, category, selector ID, and matched trigger.

Resolution records contain `test`, `reasons`, `source_manifest`, and
`schema_version`. Each reason records owner, category, selector ID, explanation,
matched triggers, services, and contracts.

## Failure And Authority Boundaries

Diagnostics are `{ source, selector_id?, field, code, target }`, sorted by those
fields. Codes cover absent metadata, versions, ownership, missing categories,
selector ordering/duplication, paths, services, contracts, category rules,
triggers, and an empty required selection.

Selected tests are read/execute scope only. Test paths, participating services,
contracts, and fixtures never expand worker filesystem-write, database, network,
secret, provider, runtime, deployment, or external-configuration authority.
Pilot adoption and current-runner cutover require their own issues.
