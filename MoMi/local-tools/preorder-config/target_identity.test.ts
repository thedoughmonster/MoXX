import assert from "node:assert/strict"
import test from "node:test"

import { assertDatabaseTarget } from "./target_identity.ts"

const devRef = "xtbraqnlskmqxinjxxdn"

test("database URL must resolve to the selected Supabase project", () => {
  assert.doesNotThrow(() => assertDatabaseTarget(
    `postgresql://postgres:secret@db.${devRef}.supabase.co/postgres`,
    devRef,
  ))
  assert.doesNotThrow(() => assertDatabaseTarget(
    `postgresql://postgres.${devRef}:secret@aws-0-us-east-1.pooler.supabase.com/postgres`,
    devRef,
  ))
  assert.throws(() => assertDatabaseTarget(
    "postgresql://postgres:secret@db.viodfldzuoypnpqaagag.supabase.co/postgres",
    devRef,
  ), /does not match/)
})
