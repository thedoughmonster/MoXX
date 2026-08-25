import assert from "node:assert/strict"
import test from "node:test"
import { createDeliveryDatabase } from "../../../tests/order_alert_delivery_v2_test_support.ts"

test("binds one current transaction capability and cleans local authority", async () => {
  const database = await createDeliveryDatabase()
  const subject = "20000000-0000-4000-8000-000000000001"
  const event = "20000000-0000-4000-8000-000000000002"
  const token = "20000000-0000-4000-8000-000000000003"
  const delivery = "20000000-0000-4000-8000-000000000004"
  try {
    await database.exec("begin")
    await database.exec(`insert into momi_api.read_capabilities (
      function_key, subject_entity_id, binding_key, capability_token, expires_at
    ) values ('momi.orders.get_by_id.v1','${subject}',
      'momi.order_alert_delivery.v1','${token}',now()+interval '30 seconds')`)
    const malformed = await database.query<{ bound: boolean }>(`select
      momi_api.bind_order_alert_delivery_v2(1,'${token}','${event}',0,
        '${delivery}') as bound`)
    assert.equal(malformed.rows[0].bound, false)
    const first = await database.query<{ bound: boolean }>(`select
      momi_api.bind_order_alert_delivery_v2(1,'${token}','${event}',7,
        '${delivery}') as bound`)
    const replay = await database.query<{ bound: boolean }>(`select
      momi_api.bind_order_alert_delivery_v2(1,'${token}','${event}',7,
        '${delivery}') as bound`)
    assert.equal(first.rows[0].bound, true)
    assert.equal(replay.rows[0].bound, false)
    await database.exec("commit")
    await database.exec(`update momi_api.read_capabilities set revoked_at=now()
      where id=1`)
    const redacted = await database.query<Record<string, unknown>>(`select
      event_id,message_id,delivery_token,redacted_at is not null as redacted
      from momi_api.order_alert_delivery_bindings_v2 where read_capability_id=1`)
    assert.deepEqual(redacted.rows[0], { event_id: null, message_id: null,
      delivery_token: null, redacted: true })

    await database.exec(`insert into momi_api.read_capabilities (
      id,function_key,subject_entity_id,binding_key,capability_token,expires_at
    ) overriding system value values
      (2,'momi.orders.get_by_id.v1','${subject}',
        'momi.order_alert_delivery.v1',gen_random_uuid(),now()+interval '1 minute'),
      (3,'momi.orders.get_by_id.v1','${subject}',
        'momi.order_alert_delivery.v2',gen_random_uuid(),now()-interval '1 minute'),
      (5,'momi.orders.get_by_id.v1','${subject}',
        'momi.order_alert_delivery.v2',gen_random_uuid(),now()+interval '1 minute')`)
    await database.exec(`insert into momi_api.order_alert_delivery_bindings_v2
      (read_capability_id,event_id,message_id,delivery_token,
        capability_expires_at,bound_at) values
      (3,gen_random_uuid(),9,gen_random_uuid(),now()-interval '1 minute',
        now()-interval '2 minutes'),
      (5,gen_random_uuid(),11,gen_random_uuid(),now()+interval '1 minute',now())`)
    await database.exec("begin")
    const candidate = await database.query<{ id: string, token: string }>(`select
      id::text,capability_token::text as token from momi_api.read_capabilities
      where id=2`)
    const bound = await database.query<{ bound: boolean }>(`select
      momi_api.bind_order_alert_delivery_v2(2,'${candidate.rows[0].token}',
        gen_random_uuid(),10,gen_random_uuid()) as bound`)
    assert.equal(bound.rows[0].bound, false, "committed capabilities are stale")
    await database.exec("rollback")
    const backlog = await database.query<{ count: number }>(`select
      count(*)::integer as count from momi_api.order_alert_delivery_bindings_v2
      where read_capability_id=3`)
    assert.equal(backlog.rows[0].count, 1, "failed binding rolls cleanup back")
    await database.exec("begin")
    await database.exec(`insert into momi_api.read_capabilities (
      id,function_key,subject_entity_id,binding_key,capability_token,expires_at
    ) overriding system value values (4,'momi.orders.get_by_id.v1','${subject}',
      'momi.order_alert_delivery.v1',gen_random_uuid(),now()+interval '1 minute')`)
    const fresh = await database.query<{ token: string }>(`select
      capability_token::text as token from momi_api.read_capabilities where id=4`)
    const cleaned = await database.query<{ bound: boolean }>(`select
      momi_api.bind_order_alert_delivery_v2(4,'${fresh.rows[0].token}',
        gen_random_uuid(),12,gen_random_uuid()) as bound`)
    assert.equal(cleaned.rows[0].bound, true)
    await database.exec("commit")
    const retained = await database.query<{ ids: number[] }>(`select
      array_agg(read_capability_id order by read_capability_id)::integer[] as ids
      from momi_api.order_alert_delivery_bindings_v2`)
    assert.deepEqual(retained.rows[0].ids, [1, 4, 5])
  } finally { await database.close() }
})
