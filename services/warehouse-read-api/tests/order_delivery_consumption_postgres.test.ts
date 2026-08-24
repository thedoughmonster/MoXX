import assert from "node:assert/strict"
import test from "node:test"
import { createDeliveryDatabase } from "../../../tests/order_alert_delivery_v2_test_support.ts"

test("order consumers witness v2 while unbound non-order stays local", async () => {
  const database = await createDeliveryDatabase()
  const subject = "40000000-0000-4000-8000-000000000001"
  const version = "40000000-0000-4000-8000-000000000002"
  const event = "40000000-0000-4000-8000-000000000003"
  try {
    await database.exec(`insert into momi_api.read_capabilities (
      function_key,subject_entity_id,subject_version_id,binding_key,expires_at
    ) values
      ('momi.orders.get_by_id.v1','${subject}',null,
        'momi.order_alert_delivery.v2',now()+interval '1 minute'),
      ('momi.orders.get_by_version.v1','${subject}','${version}',
        'momi.order_alert_delivery.v2',now()+interval '1 minute'),
      ('momi.stock_observations.get_latest.v1','${subject}',null,
        'unbound',now()+interval '1 minute'),
      ('momi.orders.get_by_id.v1','${subject}',null,
        'momi.order_alert_delivery.v1',now()+interval '1 minute'),
      ('momi.orders.get_by_id.v1','${subject}',null,
        'momi.order_alert_delivery.v2',now()+interval '1 minute'),
      ('momi.orders.get_by_id.v1','${subject}',null,
        'momi.order_alert_delivery.v2',now()+interval '1 minute'),
      ('momi.orders.get_by_version.v1','${subject}','${version}',
        'momi.order_alert_delivery.v2',now()+interval '1 minute'),
      ('momi.orders.get_by_id.v1','${subject}',null,
        'momi.order_alert_delivery.v2',now()-interval '1 minute')`)
    const caps = await database.query<{ id: string, token: string, expires: string }>(
      `select id::text,capability_token::text as token,expires_at::text as expires
      from momi_api.read_capabilities order by id`)
    await database.exec(`insert into momi_api.order_alert_delivery_bindings_v2
      (read_capability_id,event_id,message_id,delivery_token,capability_expires_at)
      values (1,'${event}',11,gen_random_uuid(),'${caps.rows[0].expires}'),
        (2,'${event}',12,gen_random_uuid(),'${caps.rows[1].expires}'),
        (5,'${event}',15,gen_random_uuid(),'${caps.rows[4].expires}'),
        (6,'${event}',16,gen_random_uuid(),'${caps.rows[5].expires}'),
        (7,'${event}',17,gen_random_uuid(),'${caps.rows[6].expires}');
      insert into momi_api.order_alert_delivery_bindings_v2
        (read_capability_id,event_id,message_id,delivery_token,
          capability_expires_at,bound_at)
        values (8,'${event}',18,gen_random_uuid(),'${caps.rows[7].expires}',
          now()-interval '2 minutes');
      insert into momi_events.delivery_witnesses
      select event_id,message_id,delivery_token,now()+interval '1 minute'
      from momi_api.order_alert_delivery_bindings_v2
      where read_capability_id in (1,2,6)`)
    const latest = await database.query<{ work: string }>(`select
      momi_api.consume_read_capability(1,'momi.orders.get_by_id.v1','${subject}',
        null,'${caps.rows[0].token}') as work`)
    const exact = await database.query<{ work: string }>(`select
      momi_api.consume_versioned_read_capability(2,
        'momi.orders.get_by_version.v1','${subject}','${version}',
        '${caps.rows[1].token}') as work`)
    const nonOrder = await database.query<{ work: string }>(`select
      momi_api.consume_read_capability(3,'momi.stock_observations.get_latest.v1',
        '${subject}',null,'${caps.rows[2].token}') as work`)
    const legacy = await database.query<{ work: string | null }>(`select
      momi_api.consume_read_capability(4,'momi.orders.get_by_id.v1','${subject}',
        null,'${caps.rows[3].token}') as work`)
    assert.deepEqual([latest.rows[0].work, exact.rows[0].work,
      nonOrder.rows[0].work, legacy.rows[0].work], ["1", "2", "3", null])
    const calls = await database.query<{ count: number }>(`select
      count(*)::integer as count from momi_events.witness_calls`)
    assert.equal(calls.rows[0].count, 2)

    await assert.rejects(database.query(`select
      momi_api.consume_read_capability(5,'momi.orders.get_by_id.v1','${subject}',
        null,'${caps.rows[4].token}')`), /query returned no rows/)
    const retry = await database.query<{ consumed_at: string | null,
      delivery_token: string | null }>(`select capability.consumed_at::text,
      binding.delivery_token::text from momi_api.read_capabilities capability
      join momi_api.order_alert_delivery_bindings_v2 binding
        on binding.read_capability_id=capability.id where capability.id=5`)
    assert.ok(retry.rows[0].consumed_at === null && retry.rows[0].delivery_token)
    await assert.rejects(database.query(`with authorized as (select
      momi_api.consume_read_capability(6,'momi.orders.get_by_id.v1','${subject}',
        null,'${caps.rows[5].token}') as work)
      select 1 / case when work is not null then 0 else 1 end from authorized`),
    /division by zero/)
    const viewRetry = await database.query<{ consumed: boolean, active: boolean }>(
      `select capability.consumed_at is not null as consumed,
        binding.delivery_token is not null as active
      from momi_api.read_capabilities capability
      join momi_api.order_alert_delivery_bindings_v2 binding
        on binding.read_capability_id=capability.id where capability.id=6`)
    assert.deepEqual(viewRetry.rows[0], { consumed: false, active: true })
    const mismatch = await database.query<{ work: string | null }>(`select
      momi_api.consume_versioned_read_capability(7,
        'momi.orders.get_by_version.v1','${subject}',gen_random_uuid(),
        '${caps.rows[6].token}') as work`)
    assert.equal(mismatch.rows[0].work, null)
    const expired = await database.query<{ work: string | null }>(`select
      momi_api.consume_read_capability(8,'momi.orders.get_by_id.v1','${subject}',
        null,'${caps.rows[7].token}') as work`)
    assert.equal(expired.rows[0].work, null)
    const pruned = await database.query<{ count: number }>(`select
      count(*)::integer as count from momi_api.order_alert_delivery_bindings_v2
      where read_capability_id=8`)
    assert.equal(pruned.rows[0].count, 0)
  } finally { await database.close() }
})
