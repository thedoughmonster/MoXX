# Service Access Debt Baseline v1

`docs/service-access-debt-baseline.json` records the exact runtime access that
predates relation-level contract enforcement. Its schema is
`schemas/service-access-debt-baseline-v1.schema.json`.

## Scope

The baseline accepts only direct access to another service's owned relation or
routine, dynamic event names, and dynamic SQL identifiers present at
`dev@fafe25d`. Runtime
TypeScript and the active definitions of migrated views and routines are both
included. It cannot authorize hosted
roles or grants, and it does not turn a private relation into a public contract.
All 137 bootstrap fingerprints are pinned independently in the checker; the
candidate baseline cannot define its own initial allowance.

## Ratchet

Every direct finding is fingerprinted from its rule, signature-stable source
path, consumer, owner, database object, access mode, exact reference count, and
the normalized SQL statements that reference that object. A body rewrite fails
CI even when it preserves the object and count. A resolved entry must be
removed and cannot be restored after `dev` advances.

Dynamic event-name findings fingerprint the active routine body, while the
dynamic relation-identifier finding fingerprints every non-test TypeScript
file in its service. Any relevant source change fails the ratchet until the
dynamic expression is replaced with an exact declared identity.

Versioned public relation reads and routine calls are exempt only when the owner
maps the exact object to a provided contract and the consumer declares that
exact provider contract.
