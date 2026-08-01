import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import postgres, { type Sql } from "postgres";

export type ArchiveTestDatabase = { container: string; sql: Sql };
const migrations = [
  "20260716164639_create_communications_archive.sql",
  "20260716164642_create_communications_separation_records.sql",
  "20260716164644_create_communications_capture_rpc.sql",
  "20260716164646_grant_communications_archive_access.sql",
  "20260728181543_add_raw_json_evidence_capture.sql",
  "20260801094433_register_square_payment_webhook_archive.sql",
];
export async function registrationSql(): Promise<string> {
  return await readFile(
    new URL(
      "../../../../supabase/migrations/" + migrations.at(-1),
      import.meta.url,
    ),
    "utf8",
  );
}

export const archivePostgresHarness = {
  docker(args: string[]): string {
    const result = spawnSync("docker", args, {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 180_000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(
        `Disposable PostgreSQL command failed: ${result.stderr.trim()}`,
      );
    }
    return result.stdout.trim();
  },
  async applyMigrations(sql: Sql): Promise<void> {
    await sql.unsafe(`
      do $$ begin
        if not exists (select from pg_roles where rolname = 'anon') then
          create role anon nologin;
        end if;
        if not exists (select from pg_roles where rolname = 'authenticated') then
          create role authenticated nologin;
        end if;
        if not exists (select from pg_roles where rolname = 'service_role') then
          create role service_role nologin;
        end if;
      end $$;
      create schema extensions;
      create extension pgcrypto with schema extensions;
    `);
    for (const migration of migrations) {
      const source = await readFile(
        new URL(
          `../../../../supabase/migrations/${migration}`,
          import.meta.url,
        ),
        "utf8",
      );
      await sql.unsafe(source);
    }
  },
  async start(): Promise<ArchiveTestDatabase> {
    const container = `momi-square-archive-${process.pid}-${Date.now()}`;
    let sql: Sql | null = null;
    try {
      archivePostgresHarness.docker([
        "run",
        "--detach",
        "--rm",
        "--name",
        container,
        "--env",
        "POSTGRES_PASSWORD=momi-archive-test",
        "--publish",
        "127.0.0.1::5432",
        "postgres:17-alpine",
      ]);
      const mapping = archivePostgresHarness.docker([
        "port",
        container,
        "5432/tcp",
      ]);
      const port = Number(mapping.match(/:(\d+)$/)?.[1]);
      if (!Number.isInteger(port)) {
        throw new Error("PostgreSQL port was not mapped");
      }
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        sql = postgres(
          `postgres://postgres:momi-archive-test@127.0.0.1:${port}/postgres`,
          { connect_timeout: 2, max: 12, prepare: false },
        );
        try {
          await sql`select 1`;
          break;
        } catch {
          await sql.end({ timeout: 1 }).catch(() => undefined);
          sql = null;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      if (!sql) throw new Error("Disposable PostgreSQL did not start");
      await archivePostgresHarness.applyMigrations(sql);
      return { container, sql };
    } catch (error) {
      await sql?.end({ timeout: 1 }).catch(() => undefined);
      spawnSync("docker", ["rm", "-f", container], { encoding: "utf8" });
      throw error;
    }
  },
  async stop(database: ArchiveTestDatabase): Promise<void> {
    await database.sql.end({ timeout: 2 }).catch(() => undefined);
    spawnSync("docker", ["rm", "-f", database.container], { encoding: "utf8" });
  },
};
