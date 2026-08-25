import assert from "node:assert/strict";

import type { Sql } from "postgres";

type CaptureReceipt = {
  disposition: string;
  archive_item_id: string;
  content_hash: string;
};

export async function capture(
  sql: Sql,
  messageKey: string,
  idempotencyKey: string,
  rawText: string,
): Promise<CaptureReceipt> {
  return await sql.begin(async (transaction) => {
    await transaction.unsafe("set local role service_role");
    const metadata = { authentication_disposition: "authenticated" };
    const [receipt] = await transaction<CaptureReceipt[]>`
      select disposition, archive_item_id::text, content_hash
      from momi_communications.capture_raw_json_evidence_v1(
        'square_payment_webhook', 'sandbox-location', 'square',
        ${`order-${messageKey}`}, ${messageKey}, 'square_provider',
        '2026-08-01T09:45:00Z'::timestamptz,
        ${transaction.json(metadata)}::jsonb,
        ${transaction.json(JSON.parse(rawText))}::jsonb,
        ${rawText}, ${idempotencyKey},
        'momi-preorder-square-webhook-v1',
        'momi-preorder-square-webhook-v1'
      )`;
    assert.ok(receipt);
    return receipt;
  });
}
