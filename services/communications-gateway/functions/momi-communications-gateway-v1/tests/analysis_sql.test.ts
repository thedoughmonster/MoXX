import assert from "node:assert/strict"
import test from "node:test"

import { validateAnalysisSql } from "../src/validate_analysis_sql.ts"

const relations = new Set(["orders_v1", "payments_v1", "order_items_v1"])

test("accepts bounded analytical selects over cataloged relations", () => {
  const daily = `select business_date, count(*) as orders,
    sum(total_amount) as sales from orders_v1
    where business_date = current_date - interval '1 day'
    group by business_date limit 10`
  assert.equal(validateAnalysisSql(daily, relations), daily)
  const joined = `select o.business_date, sum(p.amount) as paid
    from momi_analysis.orders_v1 o
    join payments_v1 p using (location_id, business_date)
    group by o.business_date`
  assert.equal(validateAnalysisSql(joined, relations), joined)
  const terminated = "select count(*) from orders_v1;"
  assert.equal(validateAnalysisSql(terminated, relations), terminated.slice(0, -1))
  const commonTable = `with shop as (
      select location_id from orders_v1 where business_date = current_date
    ), totals as (
      select count(*) as orders from orders_v1 join shop using (location_id)
    ) select * from totals`
  assert.equal(validateAnalysisSql(commonTable, relations), commonTable)
})

test("rejects mutation, multiple statements, comments, and uncataloged access", () => {
  const invalid = [
    "update orders_v1 set total_amount = 0",
    "select * from orders_v1; select * from payments_v1",
    "select * from orders_v1;;",
    "select * from orders_v1 -- hidden",
    "select * from momi_api.orders_by_id_v1",
    "select * from auth.users",
    "select pg_sleep(1) from orders_v1",
    "select set_config('role', 'postgres', false) from orders_v1",
    "select public.unsafe(total_amount) from orders_v1",
    "with changed as (delete from orders_v1 returning *) select * from changed",
    "with recursive loop as (select * from loop) select * from loop",
    "with hidden as (select * from auth.users) select * from hidden",
    "select current_user",
  ]
  for (const sql of invalid) assert.equal(validateAnalysisSql(sql, relations), null)
})
