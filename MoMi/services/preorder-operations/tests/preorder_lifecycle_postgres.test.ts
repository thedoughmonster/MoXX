import test from "node:test";

import { assertAdmission } from "./preorder_postgres/assert_admission.ts";
import { assertCurrentAuthority } from "./preorder_postgres/assert_authority.ts";
import { assertContracts } from "./preorder_postgres/assert_contracts.ts";
import { assertHolds } from "./preorder_postgres/assert_holds.ts";
import { assertLaunchPolicy } from "./preorder_postgres/assert_launch_policy.ts";
import { assertOrders } from "./preorder_postgres/assert_orders.ts";
import { assertPricingEligibility } from "./preorder_postgres/assert_pricing_eligibility.ts";
import { assertRecovery } from "./preorder_postgres/assert_recovery.ts";
import { assertSecurity } from "./preorder_postgres/assert_security.ts";
import { lifecycleFixture } from "./preorder_postgres/fixture.ts";
import { postgresHarness } from "./preorder_postgres/harness.ts";

const enabled = process.env.MOMI_PREORDER_PG_INTEGRATION === "1";

test("executes preorder state, recovery, security, and contract behavior on PostgreSQL", {
  skip: enabled ? false : "set MOMI_PREORDER_PG_INTEGRATION=1",
  timeout: 180_000,
}, async (context) => {
  const database = await postgresHarness.start();
  context.after(() => postgresHarness.stop(database));
  const windowId = await lifecycleFixture.seed(database.sql);
  await assertAdmission(database.sql);
  await assertPricingEligibility(database.sql, windowId);
  await assertLaunchPolicy(database.sql);
  const hold = await assertHolds(database.sql, windowId);
  await assertCurrentAuthority(database.sql, windowId);
  const order = await assertOrders(database.sql, windowId);
  const status = await assertRecovery(database.sql, windowId, order);
  await assertSecurity(database.sql, String(order.recovery_authority));
  await assertContracts({ hold, order, status });
});
