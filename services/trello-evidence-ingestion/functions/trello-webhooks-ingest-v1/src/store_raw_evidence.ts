import type {
  Database,
  EvidenceEnvelope,
  StoreReceipt,
} from "./types.ts"

export async function storeRawEvidence(
  database: Database,
  envelope: EvidenceEnvelope,
): Promise<StoreReceipt> {
  const rows = await database`
    select disposition, archive_item_id::text, content_hash
    from momi_communications.capture_raw_json_evidence_v1(
      ${"trello_webhook"},
      ${envelope.boardId},
      ${envelope.actorId},
      ${envelope.boardId},
      ${envelope.actionId},
      ${envelope.actorId === "trello-system" ? "trello_system" : "trello_member"},
      ${envelope.occurredAt},
      ${database.json(envelope.sourceMetadata)},
      ${database.json(envelope.payload)},
      ${envelope.rawBody},
      ${envelope.actionId},
      ${"trello-webhooks-ingest-v1"},
      ${"trello-webhooks-ingest-v1"}
    )
  `
  const row = rows[0]
  if (
    rows.length !== 1
    || (row?.disposition !== "stored" && row?.disposition !== "duplicate")
    || typeof row.archive_item_id !== "string"
    || typeof row.content_hash !== "string"
  ) throw new Error("Raw evidence capture returned an invalid receipt")
  return {
    disposition: row.disposition,
    archiveItemId: row.archive_item_id,
    contentHash: row.content_hash,
  }
}
