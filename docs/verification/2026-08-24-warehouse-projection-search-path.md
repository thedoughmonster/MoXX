# Warehouse projection search-path decision

MOX-379 resolves the PostgreSQL constraint blocking MOX-188 and draft PR #661.
No provider or production state was changed.

## Native evidence

PostgreSQL 17.9 ran the current `process_delivery_batch` body with a delivery
that reached both `COMMIT AND CHAIN` statements. A bounded `(1, 5)` call
succeeded with `proconfig = NULL`; the executable contract below uses the exact
cron arguments `(6, 60)`. After attaching
`search_path=pg_catalog`, the first commit failed with SQLSTATE `2D000`
(`invalid transaction termination`). PostgreSQL documents this restriction for
procedures with attached `SET` clauses.

Supabase supports PostgreSQL 17. Its lint 0011 query reports any routine whose
`proconfig` lacks `search_path=...`; it does not inspect source-level GUC
handling. Advisor clearance and transaction control therefore cannot coexist
on this procedure.

## Bounded designs

| Design | `proconfig` / advisor | Transaction control | Protected contracts | Decision |
| --- | --- | --- | --- | --- |
| Attached routine `SET` | pinned / clear | fails `2D000` | cron workload broken | reject |
| Transaction-local `set_config` before work and after each commit | null / warns | succeeds | ACL, cron, atomicity, output, caller state preserved | select |
| Session `set_config` | null / warns | succeeds | leaks path into caller session | reject |
| Qualified body or pinned helper | outer null / warns | succeeds | larger source refactor; advisor unchanged | reject |
| Attached wrapper around committing inner procedure | wrapper pinned | fails `2D000` | cron workload broken | reject |
| Role/database/caller default | null / warns | succeeds | broad caller configuration change | reject |

## Selected contract

MOX-188 must replace its attached-`SET` migration with a body replacement that:

1. leaves the procedure without an attached `SET` clause;
2. executes `pg_catalog.set_config('search_path', 'pg_catalog', true)` before
   the first ambient-resolved expression;
3. moves `started_at` initialization after that call; and
4. reapplies the same transaction-local setting immediately after every
   `COMMIT AND CHAIN`.

The owner, SECURITY INVOKER mode, owner-only execute ACL, exact cron row,
delivery transaction boundaries, and projection/failure output stay unchanged.
The executable test contract is
`tests/warehouse_projection_search_path_postgres.test.ts`.

## Exact MOX-188 correction

- Replace decision D-2 and AC-1's attached fixed-path requirement with the
  selected transaction-local contract above.
- Change the advisor deliverable from "warning cleared" to "lint 0011 remains
  as a documented `proconfig`-only exception for this transaction-controlling
  procedure."
- Require native PostgreSQL evidence that a hostile caller path cannot resolve
  procedure expressions before or after either commit.
- Replace `ALTER PROCEDURE ... RESET search_path` rollback with
  `CREATE OR REPLACE PROCEDURE` restoring the captured prior body. `proconfig`
  remains null before, during, and after rollback; ACL and cron need no rollback.

## Primary references

- [PostgreSQL 17 CREATE PROCEDURE](https://www.postgresql.org/docs/17/sql-createprocedure.html)
- [PostgreSQL 17 transaction management](https://www.postgresql.org/docs/17/plpgsql-transactions.html)
- [Supabase PostgreSQL 17 upgrade support](https://supabase.com/docs/guides/platform/upgrading)
- [Supabase Splinter lint source](https://github.com/supabase/splinter/blob/main/splinter.sql)
