import type { Sql } from "postgres";
import { waitForDatabaseBlock } from "./wait_for_database_block.ts";

export async function runCapacityPublicationRace<T>(
  sql: Sql, publish: (connection: Sql) => PromiseLike<T>,
  operations: Array<(connection: Sql) => PromiseLike<T>>,
): Promise<T[]> {
  const publisher = await sql.reserve();
  const workers = await Promise.all(operations.map(() => sql.reserve()));
  let pending: Promise<T[]> | undefined;
  let committed = false;
  try {
    await publisher`begin`;
    await publisher`set local statement_timeout = '15s'`;
    const [owner] = await publisher`select pg_backend_pid() as pid`;
    const pids = await Promise.all(workers.map(async (worker) => {
      await worker`set statement_timeout = '15s'`;
      const [row] = await worker`select pg_backend_pid() as pid`;
      return row.pid as number;
    }));
    const publication = await publish(publisher as unknown as Sql);
    pending = Promise.all(operations.map((operation, index) =>
      Promise.resolve(operation(workers[index] as unknown as Sql))));
    void pending.catch(() => undefined);
    // The changed publication owns S and C until commit. Observe the expiry,
    // publication replay, both admissions, and release waiting on those locks.
    await waitForDatabaseBlock(sql, pids.slice(0, 2), owner.pid);
    for (const index of [2, 3, 4]) {
      await waitForDatabaseBlock(sql, pids[index], owner.pid);
    }
    await waitForDatabaseBlock(sql, pids.slice(5, 7), owner.pid);
    await publisher`commit`;
    committed = true;
    return [publication, ...await pending];
  } finally {
    if (!committed) await publisher`rollback`;
    await pending?.catch(() => undefined);
    for (const worker of workers) {
      await worker`reset statement_timeout`;
      worker.release();
    }
    publisher.release();
  }
}
