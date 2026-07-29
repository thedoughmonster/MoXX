import postgres from "postgres";

import { assertDatabaseTarget } from "./target_identity.ts";
import type { PreorderConfiguration } from "./types.ts";

export async function publishConfig(
  config: PreorderConfiguration,
  digest: string,
  actorRef: string,
  projectRef: string,
): Promise<unknown> {
  const databaseUrl = process.env.MOMI_PREORDER_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("MOMI_PREORDER_DATABASE_URL is not configured");
  }
  assertDatabaseTarget(databaseUrl, projectRef);
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ssl: "verify-full",
  });
  try {
    const rows = await sql<{ receipt: unknown }[]>`
      select momi_preorder.publish_configuration_v1(
        ${sql.json(config)}, ${digest}, ${actorRef}
      ) as receipt
    `;
    return rows[0]?.receipt;
  } finally {
    await sql.end();
  }
}
