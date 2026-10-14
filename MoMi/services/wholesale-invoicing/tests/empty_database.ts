import { PGlite } from "@electric-sql/pglite"

export async function emptyDatabase() {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create role invoice_test_owner nologin nosuperuser nocreaterole nocreatedb;
      create role unrelated_runtime nologin;
      create schema unrelated; create table unrelated.fixture (value text);
      insert into unrelated.fixture values ('preserved');
      grant usage on schema unrelated to invoice_test_owner, anon;
      grant select on unrelated.fixture to invoice_test_owner, anon;
      do $$ begin execute format('grant create on database %I to invoice_test_owner', current_database()); end; $$;
      set role invoice_test_owner;`)
    return db
  } catch (error) { await db.close(); throw error }
}
