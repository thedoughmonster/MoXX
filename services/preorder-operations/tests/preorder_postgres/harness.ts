import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import postgres, { type Sql } from "postgres";

export type TestDatabase = { container: string; sql: Sql };

export const postgresHarness = {
  docker(args: string[]): string {
    const result = spawnSync("docker", args, {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 180_000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Disposable PostgreSQL command failed: ${result.stderr.trim()}`);
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
    for (const migration of [
      "20260728204051_create_preorder_bootstrap_foundation.sql",
      "20260729183503_add_preorder_configuration_publication.sql",
      "20260729203650_add_preorder_quote_authority.sql",
      "20260729211630_add_preorder_intent_lifecycle.sql",
      "20260731135356_add_preorder_payment_attempt_boundary.sql",
      "20260801184632_expose_preorder_payment_recovery_identity.sql",
      "20260805081330_add_preorder_pricing_eligibility_policy.sql",
      "20260805135432_add_preorder_launch_policy_v3.sql",
    ]) {
      const source = await readFile(new URL(
        `../../../../supabase/migrations/${migration}`,
        import.meta.url,
      ), "utf8");
      await sql.unsafe(source);
    }
  },
  async start(): Promise<TestDatabase> {
    const container = `momi-preorder-${process.pid}-${Date.now()}`;
    let sql: Sql | null = null;
    try {
      postgresHarness.docker([
        "run", "--detach", "--rm", "--name", container,
        "--env", "POSTGRES_PASSWORD=momi-preorder-test",
        "--publish", "127.0.0.1::5432", "postgres:17-alpine",
      ]);
      const mapping = postgresHarness.docker(["port", container, "5432/tcp"]);
      const port = Number(mapping.match(/:(\d+)$/)?.[1]);
      if (!Number.isInteger(port)) throw new Error("PostgreSQL port was not mapped");
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        sql = postgres(
          `postgres://postgres:momi-preorder-test@127.0.0.1:${port}/postgres`,
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
      await postgresHarness.applyMigrations(sql);
      return { container, sql };
    } catch (error) {
      await sql?.end({ timeout: 1 }).catch(() => undefined);
      spawnSync("docker", ["rm", "-f", container], { encoding: "utf8" });
      throw error;
    }
  },
  async stop(database: TestDatabase): Promise<void> {
    await database.sql.end({ timeout: 2 }).catch(() => undefined);
    spawnSync("docker", ["rm", "-f", database.container], { encoding: "utf8" });
  },
};
