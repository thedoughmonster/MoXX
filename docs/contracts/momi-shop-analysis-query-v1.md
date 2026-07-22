# MoMi Shop Analysis Query v1

Owner: `warehouse-read-api`

Consumer: `communications-gateway`

## Input

- one PostgreSQL `SELECT`, at most 6,000 UTF-8 characters;
- an admitted gateway invocation and authenticated beta user;
- a read-only transaction running as `svc_communications_gateway`.

The gateway parser accepts exactly one statement, cataloged relations only,
and a fixed set of analytical functions. Comments, data-changing statements,
session changes, catalog access, and unlisted schemas or functions are invalid.

## Data

The database catalog describes the enabled curated relations and columns. The
initial contract covers scope/timezone, orders, order items, payments, menu
items, schedules, and non-identifying time entries. Customer labels, employee
identity, source
payloads, communications, auth records, and private control state are absent.

## Output

The executor returns JSON containing up to 100 rows, a returned row count, and
a truncation flag. Execution stops after six seconds and rejects output above
64 KiB. SQL text, relation names, UUIDs, and other implementation details are
not user-facing response requirements.

## Failure

Invalid syntax, an unlisted relation or function, a non-read-only transaction,
the wrong runtime role, timeout, oversized output, or database error fails the
tool call closed. It creates no provider retry and no database write.
