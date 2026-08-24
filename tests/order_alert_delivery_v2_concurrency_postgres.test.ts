import assert from "node:assert/strict"
import { setTimeout as delay } from "node:timers/promises"
import test from "node:test"
import postgres from "postgres"
import { deliveryDatabaseSetupSql } from
  "./order_alert_delivery_v2_test_support.ts"

const databaseUrl = process.env.ORDER_ALERT_DELIVERY_CONCURRENCY_DATABASE_URL

test("concurrent delivery binding and consumption have one winner", {
  skip: !databaseUrl,
}, async () => {
  const first = postgres(databaseUrl as string, { max: 1, prepare: false })
  const second = postgres(databaseUrl as string, { max: 1, prepare: false })
  const observer = postgres(databaseUrl as string, { max: 1, prepare: false })
  const subject = "30000000-0000-4000-8000-000000000001"
  const event = "30000000-0000-4000-8000-000000000002"
  const token = "30000000-0000-4000-8000-000000000003"
  const delivery = "30000000-0000-4000-8000-000000000004"
  const secondToken = "30000000-0000-4000-8000-000000000005"
  try {
    await first.unsafe(deliveryDatabaseSetupSql)
    const firstPid = await first.unsafe<{ pid: number }[]>(
      "select pg_backend_pid()::integer as pid")
    const secondPid = await second.unsafe<{ pid: number }[]>(
      "select pg_backend_pid()::integer as pid")
    assert.notEqual(firstPid[0].pid, secondPid[0].pid)
    await first.unsafe("begin")
    const firstCapability = await first.unsafe<{ id: number }[]>(`insert into
      momi_api.read_capabilities (
      function_key,subject_entity_id,binding_key,capability_token,expires_at
    ) values ('momi.orders.get_by_id.v1','${subject}',
      'momi.order_alert_delivery.v1','${token}',now()+interval '30 seconds')
      returning id`)
    const winner = await first.unsafe<{ bound: boolean }[]>(`select
      momi_api.bind_order_alert_delivery_v2(${firstCapability[0].id},
        '${token}','${event}',7,
        '${delivery}') as bound`)
    assert.equal(winner[0].bound, true)

    await second.unsafe("begin")
    const secondCapability = await second.unsafe<{ id: number }[]>(`insert into
      momi_api.read_capabilities (
      function_key,subject_entity_id,binding_key,capability_token,expires_at
    ) values ('momi.orders.get_by_id.v1','${subject}',
      'momi.order_alert_delivery.v1','${secondToken}',now()+interval '30 seconds')
      returning id`)
    const replay = second.unsafe(`select
      momi_api.bind_order_alert_delivery_v2(${secondCapability[0].id},
        '${secondToken}','${event}',7,'${delivery}') as bound`).execute()
    let bindBlockers: number[] = []
    for (let attempt = 0; attempt < 100 && bindBlockers.length === 0;
      attempt += 1) {
      await delay(10)
      const state = await observer.unsafe<{ blockers: number[] }[]>(`select
        pg_blocking_pids(${secondPid[0].pid}) as blockers`)
      bindBlockers = state[0].blockers
    }
    await first.unsafe("commit")
    try {
      await assert.rejects(replay, { code: "23505" })
    } finally {
      await second.unsafe("rollback")
    }
    assert.ok(bindBlockers.includes(firstPid[0].pid))
    const committedReplay = await second.unsafe<{ bound: boolean }[]>(`select
      momi_api.bind_order_alert_delivery_v2(${firstCapability[0].id},
        '${token}','${event}',7,'${delivery}') as bound`)
    assert.equal(committedReplay[0].bound, false)
    const bindingCount = await first.unsafe<{ count: number }[]>(`select
      count(*)::integer as count
      from momi_api.order_alert_delivery_bindings_v2`)
    assert.equal(bindingCount[0].count, 1)
    await first.unsafe(`insert into momi_events.delivery_witnesses values
      ('${event}',7,'${delivery}',now()+interval '1 minute')`)

    await first.unsafe("begin")
    const consumed = await first.unsafe<{ work: string }[]>(`select
      momi_api.consume_read_capability(${firstCapability[0].id},
        'momi.orders.get_by_id.v1','${subject}',null,'${token}') as work`)
    const contender = second.unsafe<{ work: string | null }[]>(`select
      momi_api.consume_read_capability(${firstCapability[0].id},
        'momi.orders.get_by_id.v1','${subject}',null,'${token}') as work`).execute()
    let consumeBlockers: number[] = []
    for (let attempt = 0; attempt < 100 && consumeBlockers.length === 0;
      attempt += 1) {
      await delay(10)
      const state = await observer.unsafe<{ blockers: number[] }[]>(`select
        pg_blocking_pids(${secondPid[0].pid}) as blockers`)
      consumeBlockers = state[0].blockers
    }
    await first.unsafe("commit")
    const contenderResult = await contender
    assert.ok(consumeBlockers.includes(firstPid[0].pid))
    assert.equal(consumed[0].work, String(firstCapability[0].id))
    assert.equal(contenderResult[0].work, null)
    const terminal = await first.unsafe<{ calls: number, active: number }[]>(`select
      (select count(*)::integer from momi_events.witness_calls) as calls,
      (select count(*)::integer from momi_api.order_alert_delivery_bindings_v2
        where delivery_token is not null) as active`)
    assert.deepEqual(terminal[0], { calls: 1, active: 0 })
  } finally {
    await Promise.all([first.end(), second.end(), observer.end()])
  }
})
