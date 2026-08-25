import test from "node:test";

import { assertRegistration } from "./square_webhook_postgres/assertions.ts";
import { archivePostgresHarness } from "./square_webhook_postgres/harness.ts";
import { assertReplayAndConcurrency } from "./square_webhook_postgres/replay.ts";
import { assertSecurity } from "./square_webhook_postgres/security.ts";

const enabled = process.env.MOMI_COMMUNICATIONS_ARCHIVE_PG_INTEGRATION === "1";

test(
  "executes Square webhook archive registration, replay, concurrency, and security",
  {
    skip: enabled ? false : "set MOMI_COMMUNICATIONS_ARCHIVE_PG_INTEGRATION=1",
    timeout: 180_000,
  },
  async (context) => {
    const database = await archivePostgresHarness.start();
    context.after(() => archivePostgresHarness.stop(database));

    await assertRegistration(database.sql);
    await assertReplayAndConcurrency(database.sql);
    await assertSecurity(database.sql);
  },
);
