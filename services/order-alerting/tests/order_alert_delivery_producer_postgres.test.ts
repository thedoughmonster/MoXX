import assert from "node:assert/strict"
import test from "node:test"
import { createDeliveryDatabase } from "../../../tests/order_alert_delivery_v2_test_support.ts"

test("wrapper delegates once and rolls issuance back when binding fails", async () => {
  const database = await createDeliveryDatabase()
  const invocation = "30000000-0000-4000-8000-000000000001"
  const event = "30000000-0000-4000-8000-000000000002"
  const delivery = "30000000-0000-4000-8000-000000000003"
  try {
    const issued = await database.query<{ read_work_id: string }>(`select * from
      momi_alerting.issue_order_read_capability_v2(
        1,2,'${invocation}','${event}',8,'${delivery}')`)
    assert.equal(issued.rows.length, 1)
    const counts = await database.query<{ calls: number, bindings: number }>(`select
      (select count(*)::integer from momi_alerting.issuer_calls) as calls,
      (select count(*)::integer from momi_api.order_alert_delivery_bindings_v2)
        as bindings`)
    assert.deepEqual(counts.rows[0], { calls: 1, bindings: 1 })
    await database.exec(`update momi_alerting.issuer_control set mode='mismatch'`)
    await assert.rejects(database.query(`select * from
      momi_alerting.issue_order_read_capability_v2(
        3,4,'${invocation}','${event}',9,'${delivery}')`),
    /Canonical read capability binding is unavailable/)
    const rolledBack = await database.query<{ calls: number, capabilities: number }>(
      `select (select count(*)::integer from momi_alerting.issuer_calls) as calls,
        (select count(*)::integer from momi_api.read_capabilities) as capabilities`)
    assert.deepEqual(rolledBack.rows[0], { calls: 1, capabilities: 1 })
  } finally { await database.close() }
})
