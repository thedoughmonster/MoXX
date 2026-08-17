import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";

import { appendConcurrencyEvent } from "./project_baseline_ledger_concurrency_append.ts";

const databaseUrl = process.env.PROJECT_BASELINE_CONCURRENCY_DATABASE_URL;

test("serializes supersession against a concurrent target revoke", {
  skip: !databaseUrl,
}, async () => {
  const first = postgres(databaseUrl as string, { max: 1, prepare: false });
  const second = postgres(databaseUrl as string, { max: 1, prepare: false });
  let releaseTransaction = () => undefined;
  let signalRevoked = () => undefined;
  const hold = new Promise<void>((resolve) => { releaseTransaction = resolve; });
  const revoked = new Promise<void>((resolve) => { signalRevoked = resolve; });
  try {
    await appendConcurrencyEvent(first, {
      decision: "PB-CONCURRENT-TARGET", status: "proposed",
      event: "PB-CONCURRENT-TARGET:proposed",
    });
    const target = await appendConcurrencyEvent(first, {
      decision: "PB-CONCURRENT-TARGET", status: "accepted",
      event: "PB-CONCURRENT-TARGET:accepted",
    });
    await appendConcurrencyEvent(first, {
      decision: "PB-CONCURRENT-SUBJECT", status: "proposed",
      event: "PB-CONCURRENT-SUBJECT:proposed",
    });
    await appendConcurrencyEvent(first, {
      decision: "PB-CONCURRENT-SUBJECT", status: "accepted",
      event: "PB-CONCURRENT-SUBJECT:accepted",
    });
    const revocation = first.begin(async (transaction) => {
      await appendConcurrencyEvent(transaction, {
        decision: "PB-CONCURRENT-TARGET", status: "revoked",
        event: "PB-CONCURRENT-TARGET:revoked",
      });
      signalRevoked();
      await hold;
    });
    await revoked;
    let settled = false;
    const supersession = appendConcurrencyEvent(second, {
      decision: "PB-CONCURRENT-SUBJECT", status: "superseded",
      event: "PB-CONCURRENT-SUBJECT:superseded",
      relatedDecisionId: target.decision_id,
    }).then(
      () => ({ error: null }),
      (error: unknown) => ({ error }),
    ).finally(() => { settled = true; });
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(settled, false, "supersession did not block on the target lock");
    releaseTransaction();
    await revocation;
    const result = await supersession;
    assert.match(String(result.error), /superseding decision must currently be accepted/u);
  } finally {
    await Promise.all([first.end(), second.end()]);
  }
});
