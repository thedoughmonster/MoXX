# Kitchen Task Management

## ELI5

This is MoMi's permanent kitchen task ledger. Trello may display and update the
work today, but this service remembers the real task, who changed it, and when.

## Boundary

The service owns recurring templates, daily task instances, assignment,
checklists, workflow state, identity mappings, external references, desired
Trello state, and append-only audit events. It reads only immutable archive
evidence through a purpose-bound contract and sends only prepared operations to
the Trello delivery adapter.

Runtime relations, processors, schedules, and subscriptions land in later
additive changes and remain disabled until their release is authorized.

## Implementation and contract posture

This service is declared, not implemented or hosted. The command identities
`momi.kitchen_tasks.command.v1` and
`momi.kitchen_tasks.consume_trello_evidence.v1` are reserved and unbound, so
they are non-callable until separately reviewed implementation bindings exist.
The `kitchen.task.changed` event identity is also reserved and unbound: no
producer is bound and no runtime emission is asserted.

The empty function, private-relation, private-routine, public-read, and
deployment-ownership collections mean there is no callable or emitting
implementation. Database read/write entries and `private_schema` declare
authority only; they are not evidence that database objects exist.
