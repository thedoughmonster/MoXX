import test from "node:test";

import { assertPaymentClaims } from "./preorder_postgres/assert_payment_claims.ts";
import { assertPaymentContracts } from "./preorder_postgres/assert_payment_contracts.ts";
import { assertPaymentMismatch } from "./preorder_postgres/assert_payment_mismatch.ts";
import { assertPaymentMatrix } from "./preorder_postgres/assert_payment_matrix.ts";
import { assertPaymentProjection } from "./preorder_postgres/assert_payment_projection.ts";
import { assertPaymentReconciliation } from "./preorder_postgres/assert_payment_reconciliation.ts";
import { assertPaymentRecovery } from "./preorder_postgres/assert_payment_recovery.ts";
import { assertPaymentSecurity } from "./preorder_postgres/assert_payment_security.ts";
import { lifecycleFixture } from "./preorder_postgres/fixture.ts";
import { postgresHarness } from "./preorder_postgres/harness.ts";

const enabled = process.env.MOMI_PREORDER_PG_INTEGRATION === "1";

test("executes durable payment claim, projection, recovery, and security", {
  skip: enabled ? false : "set MOMI_PREORDER_PG_INTEGRATION=1",
  timeout: 180_000,
}, async (context) => {
  const database = await postgresHarness.start();
  context.after(() => postgresHarness.stop(database));
  const windowId = await lifecycleFixture.seed(database.sql);
  const claim = await assertPaymentClaims(database.sql, windowId);
  await assertPaymentContracts(claim);
  await assertPaymentMatrix(database.sql, String(claim.receipt.order_id));
  await assertPaymentProjection(database.sql, claim);
  await assertPaymentMismatch(database.sql, windowId);
  await assertPaymentRecovery(database.sql, windowId);
  await assertPaymentReconciliation(database.sql, windowId);
  await assertPaymentSecurity(database.sql);
});
