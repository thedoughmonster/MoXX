# Repository Diagnostic v1

Owner: non-deployable repository validation tooling.

The authoritative shape is
[`schemas/repository-diagnostic-v1.schema.json`](../../schemas/repository-diagnostic-v1.schema.json),
with TypeScript types in `scripts/diagnostics/types.ts`. `schema_version: 1`
identifies this contract. The renderer is
`scripts/diagnostics/render_repository_diagnostics.ts`.

## Producer contract

A repository-owned deterministic check may emit this shape when it already
knows a valid correction boundary. It must reuse its current `rule_id` and the
existing `hard_stop` or `advisory` enforcement. This contract does not register
rules, decide enforcement, execute a repair, or change exit status.

The producer supplies only facts it knows:

- `location` is omitted when unavailable. A known path may omit line and column.
- `expected` states the valid correction or ownership/architecture boundary.
- `repair.kind: command` is allowed only for an exact safe command. Otherwise
  the producer uses `repair.kind: none`; `rationale` may briefly explain a
  choice that cannot be inferred from the violated rule and expected outcome.
- `validation_command` is the exact observational command that proves the
  correction. It is always required and is never an automatic fix.
- `fingerprint.group` contains existing stable rule/remediation identity fields;
  `fingerprint.instance` adds stable occurrence fields. Include only available,
  redacted primitive values. Do not add timestamps, prose, absolute workspace
  paths, credentials, or a new rule identity merely for this contract.

The renderer canonicalizes fingerprint objects, groups matching rule and
remediation data, deduplicates matching instances, sorts independently of input
order, retains every distinct location, and shows opaque SHA-256 fingerprints.
Displayed hashes use only the schema/rule/enforcement identity and defensively
redacted fingerprint fields; rationale and other presentation prose never
affect them. The renderer strips terminal and Unicode default-ignorable
controls, escapes embedded line breaks, and checks compacted separator-free
text before redacting human-presented strings and fingerprint values. Exact
repair and validation commands must be single-line and free of controls or
invisible formatting. Producers remain responsible for not placing secrets in
structured diagnostics.

## Adoption

An existing check constructs diagnostics beside its current deterministic
finding logic, renders them at the point where it currently reports findings,
and preserves its existing throw, warning, and process-exit behavior. Raw or
third-party failures remain native when the repository cannot state a
deterministic remediation. Adoption adds no review, policy, validation, or
governance stage.

Run focused contract coverage with:

```sh
node --test tests/repository_diagnostic_schema.test.ts \
  tests/repository_diagnostic_renderer.test.ts
```
