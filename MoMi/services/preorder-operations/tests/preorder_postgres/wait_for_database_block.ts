import assert from "node:assert/strict";
import type { Sql } from "postgres";

export async function waitForDatabaseBlock(
  sql: Sql, waiter: number | number[], blocker: number,
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const [row] = await sql`with recursive waiting(pid) as (
      select unnest(${Array.isArray(waiter) ? waiter : [waiter]}::integer[])
      union select unnest(pg_blocking_pids(pid)) from waiting
    ) select exists (select 1 from waiting
      where pid = ${blocker}::integer) as blocked`;
    if (row.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`Backend ${waiter} did not wait for ${blocker}`);
}
