export interface LedgerConcurrencyEvent {
  decision: string;
  status: "proposed" | "accepted" | "superseded" | "revoked";
  event: string;
  relatedDecisionId?: string;
}

export interface LedgerConcurrencyResult {
  decision_id: string;
  event_id: string;
  lifecycle_status: string;
}
