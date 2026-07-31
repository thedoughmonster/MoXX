import assert from "node:assert/strict"
import test from "node:test"
import { executeSquarePayment } from "../src/execute_square_payment.ts"
import type { PaymentCommand, SquareEnvelope } from "../src/types.ts"

const command: PaymentCommand = {
  payment_attempt_id: "70000000-0000-4000-8000-000000000274",
  owner_order_id: "70000000-0000-4000-8000-000000000273",
  amount_minor: 2400, currency: "USD", source_token: crypto.randomUUID(),
}

test("execution binds exact provider request and returns a safe receipt", async () => {
  let request: { input?: RequestInfo | URL; init?: RequestInit } = {}
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    request = { input, init }
    return Response.json({ payment: {
      id: "sandbox-payment", status: "COMPLETED",
      reference_id: command.owner_order_id, location_id: "sandbox-location",
      updated_at: "2026-07-31T15:30:00Z",
      amount_money: { amount: 2400, currency: "USD" },
    } })
  }) as typeof fetch
  const receipt = await executeSquarePayment(
    command, "sandbox-location", crypto.randomUUID(), "2026-07-15", fetcher,
  )
  const body = JSON.parse(String(request.init?.body))
  assert.equal(request.input, "https://connect.squareupsandbox.com/v2/payments")
  assert.equal(body.idempotency_key, command.payment_attempt_id)
  assert.equal(body.reference_id, command.owner_order_id)
  assert.deepEqual(body.amount_money, { amount: 2400, currency: "USD" })
  assert.equal(body.source_id, command.source_token)
  assert.equal(receipt.payment_status, "paid")
})

test("transport failure remains indeterminate and recoverable", async () => {
  const failure = (async () => { throw new Error("sandbox unavailable") }) as typeof fetch
  const receipt = await executeSquarePayment(
    command, "sandbox-location", crypto.randomUUID(), "2026-07-15", failure,
  )
  assert.equal(receipt.payment_status, "indeterminate")
  assert.equal(receipt.recovery, "retrieve")
})

test("duplicate execution preserves one Square idempotency identity", async () => {
  const bodies: string[] = []
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(String(init?.body))
    return Response.json({ errors: [{ category: "PAYMENT_METHOD_ERROR" }] })
  }) as typeof fetch
  const secret = crypto.randomUUID()
  await executeSquarePayment(command, "sandbox-location", secret, "2026-07-15", fetcher)
  await executeSquarePayment(command, "sandbox-location", secret, "2026-07-15", fetcher)
  assert.equal(JSON.parse(bodies[0]).idempotency_key, JSON.parse(bodies[1]).idempotency_key)
})

test("success, pending, and decline map through the hosted client", async () => {
  const common = {
    id: "sandbox-payment", reference_id: command.owner_order_id,
    location_id: "sandbox-location", amount_money: { amount: 2400, currency: "USD" },
    updated_at: "2026-07-31T15:30:00Z",
  }
  const run = (envelope: SquareEnvelope) => executeSquarePayment(
    command, "sandbox-location", crypto.randomUUID(), "2026-07-15",
    (async () => Response.json(envelope)) as typeof fetch,
  )
  assert.equal((await run({ payment: { ...common, status: "COMPLETED" } })).payment_status, "paid")
  assert.equal((await run({ payment: { ...common, status: "PENDING" } })).recovery, "retrieve")
  assert.equal((await run({ errors: [{ category: "PAYMENT_METHOD_ERROR" }] })).payment_status, "declined")
})

test("non-success and mismatched provider results fail indeterminate", async () => {
  const run = (envelope: SquareEnvelope, status = 200) => executeSquarePayment(
    command, "sandbox-location", crypto.randomUUID(), "2026-07-15",
    (async () => Response.json(envelope, { status })) as typeof fetch,
  )
  const failed = await run({ payment: { id: "false-paid", status: "COMPLETED",
    updated_at: "2026-07-31T15:30:00Z" } }, 500)
  assert.equal(failed.payment_status, "indeterminate")
  const mismatch = await run({ payment: {
    id: "sandbox-payment", status: "COMPLETED", reference_id: command.owner_order_id,
    location_id: "sandbox-location", amount_money: { amount: 2401, currency: "USD" },
    updated_at: "2026-07-31T15:30:00Z",
  } })
  assert.equal(mismatch.recovery, "operator_review")
  const invalidTimestamp = await run({ payment: {
    id: "sandbox-payment", status: "COMPLETED",
    reference_id: command.owner_order_id, location_id: "sandbox-location",
    amount_money: { amount: 2400, currency: "USD" },
    updated_at: "not-a-timestamp",
  } })
  assert.equal(invalidTimestamp.provider_updated_at, null)
  assert.equal(invalidTimestamp.recovery, "operator_review")
})
