import assert from "node:assert/strict"
import test from "node:test"
import { adminTestDatabase } from "../../../tests/admin_sales_read_test_support.ts"

test("admin sales aggregate preserves scope, history, missingness and cents", async () => {
  const db = await adminTestDatabase()
  try {
    await db.exec("set role svc_warehouse_read_api")
    const issued = await db.query<{ token: string }>(
      "select momi_admin_reads.issue_read_capability_v1($1,$2) as token",
      ["dough-monster-admin", "sales/health"])
    const result = await db.query<{ dataset: Record<string, unknown> }>(
      "select momi_admin_reads.read_sales_health_v1($1) as dataset",
      [issued.rows[0].token])
    const data = result.rows[0].dataset
    assert.equal(data.schemaVersion, 1)
    assert.equal(data.timezone, "America/New_York")
    assert.equal(data.location, "Berwick")
    assert.equal(data.bucketMinutes, 15)
    assert.equal("completeThrough" in data, false)
    const days = data.days as Array<Record<string, unknown>>
    assert.equal(days.length, 3)
    assert.equal(days[0].sales, 7)
    assert.equal(days[1].sales, -5)
    assert.equal(days[2].sales, 92)
    assert.equal(days[2].orders, 5)
    assert.equal(days[2].ordinarySales, 42)
    assert.equal(days[2].ordinaryOrders, 3)
    assert.equal(days[2].missingTimes, 1)
    assert.equal(days[2].missingAmounts, 1)
    assert.deepEqual(days[2].buckets, [
      [360, 10, 1, 10, 1, "counter"],
      [495, 50, 1, 0, 0, "delivery"],
      [540, 0, 1, 0, 0, "counter"],
      [930, 20, 1, 20, 1, "counter"],
    ])
    assert.deepEqual(days[2].channels, [
      { channel: "counter", sales: 30, orders: 3 },
      { channel: "delivery", sales: 50, orders: 1 },
      { channel: "unknown", sales: 12, orders: 1 },
    ])
    const serialized = JSON.stringify(data)
    assert.doesNotMatch(serialized, /location_id|order_id|employee|payload|10000000|888|999/)
    assert.ok(Date.parse(String(data.capturedAt)) > Date.parse(String(data.latestObservation)))
    const replay = await db.query<{ dataset: unknown }>(
      "select momi_admin_reads.read_sales_health_v1($1) as dataset",
      [issued.rows[0].token])
    assert.equal(replay.rows[0].dataset, null)
  } finally { await db.close() }
})

test("disabled, expired, unknown, wrong resource and over-limit reads fail closed", async () => {
  const db = await adminTestDatabase()
  try {
    await db.exec("set role svc_warehouse_read_api")
    for (const pair of [["unknown", "sales/health"], ["dough-monster-admin", "team/payroll"]]) {
      const denied = await db.query<{ token: string | null }>(
        "select momi_admin_reads.issue_read_capability_v1($1,$2) as token", pair)
      assert.equal(denied.rows[0].token, null)
    }
    const tokens: string[] = []
    for (let index = 0; index < 6; index++) {
      const issued = await db.query<{ token: string }>(
        "select momi_admin_reads.issue_read_capability_v1('dough-monster-admin','sales/health') as token")
      assert.ok(issued.rows[0].token)
      tokens.push(issued.rows[0].token)
    }
    assert.equal(new Set(tokens).size, 6)
    const limited = await db.query<{ token: string | null }>(
      "select momi_admin_reads.issue_read_capability_v1('dough-monster-admin','sales/health') as token")
    assert.equal(limited.rows[0].token, null)
    await db.exec("reset role")
    await db.query("update momi_admin_reads.capabilities_v1 set created_at=now()-interval '2 minutes', expires_at=now()-interval '1 minute 40 seconds' where capability_token=$1", [tokens[0]])
    await db.exec("set role svc_warehouse_read_api")
    const expired = await db.query<{ data: unknown }>(
      "select momi_admin_reads.read_sales_health_v1($1) as data", [tokens[0]])
    assert.equal(expired.rows[0].data, null)
    await db.exec("reset role")
    await db.exec("update momi_admin_reads.consumers_v1 set enabled=false")
    await db.exec("set role svc_warehouse_read_api")
    const revoked = await db.query<{ data: unknown }>(
      "select momi_admin_reads.read_sales_health_v1($1) as data", [tokens[1]])
    assert.equal(revoked.rows[0].data, null)
    await assert.rejects(db.exec("update momi_admin_reads.consumers_v1 set enabled=true"),
      /permission denied/)
    await assert.rejects(db.exec("select * from toast_raw.private_evidence"),
      /permission denied/)
  } finally { await db.close() }
})

test("anonymous, authenticated and service roles cannot read or issue admin data", async () => {
  const db = await adminTestDatabase()
  try {
    for (const role of ["anon", "authenticated", "service_role"]) {
      await db.exec("set role " + role)
      await assert.rejects(db.exec("select * from momi_analysis.admin_sales_health_v1"),
        /permission denied/)
      await assert.rejects(db.exec("select momi_admin_reads.issue_read_capability_v1('dough-monster-admin','sales/health')"),
        /permission denied/)
      await db.exec("reset role")
    }
    await assert.rejects(db.exec("select momi_admin_reads.issue_read_capability_v1('dough-monster-admin','sales/health')"),
      /insufficient_privilege/)
  } finally { await db.close() }
})
