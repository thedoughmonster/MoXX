import { getDatabase } from "./database.ts"
import type {
  CaptureReceipt,
  JsonRecord,
  WebhookArchiveContext,
} from "./types.ts"

export async function captureRawEvidence(
  rawText: string,
  payload: JsonRecord,
  context: WebhookArchiveContext,
): Promise<CaptureReceipt> {
  const sql = getDatabase()
  const metadata = {
    authentication_disposition: context.authenticationDisposition,
  }
  const rows = await sql<Record<string, unknown>[]>`
    select disposition, archive_item_id::text, content_hash
    from momi_communications.capture_raw_json_evidence_v1(
      ${"square_payment_webhook"}, ${context.locationId}, ${"square"},
      ${context.orderId ?? "unresolved"}, ${context.evidenceId},
      ${"square_provider"}, ${context.occurredAt},
      ${sql.json(metadata)}, ${sql.json(payload)}, ${rawText},
      ${context.evidenceId}, ${"momi-preorder-square-webhook-v1"},
      ${"momi-preorder-square-webhook-v1"}
    )
  `
  const row = rows[0]
  if (rows.length !== 1 ||
      (row?.disposition !== "stored" && row?.disposition !== "duplicate") ||
      typeof row.archive_item_id !== "string" ||
      typeof row.content_hash !== "string") {
    throw new Error("invalid_archive_receipt")
  }
  return row as CaptureReceipt
}
