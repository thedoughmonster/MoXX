import { canonicalJson } from "../../scripts/dev_loop/canonical_json.ts"
import { hashText } from "../../scripts/dev_loop/hash_text.ts"
import { retentionProjects, retentionVersions } from "../../scripts/release/retention/policy.ts"
import type {
  RetentionApproval, RetentionApprovalContext, RetentionEnvironment,
} from "../../scripts/release/retention/types.ts"

// Deliberately synthetic identities: no production approval or evidence is embedded here.
export function retentionApprovalFixture(environment: RetentionEnvironment = "dev"): {
  approval: RetentionApproval
  context: RetentionApprovalContext
} {
  const approval: RetentionApproval = {
    schema_version: 1,
    kind: "retention-release-exception",
    environment,
    project_ref: retentionProjects[environment],
    source_sha: "a".repeat(40),
    issued_at: "2026-10-22T12:00:00Z",
    expires_at: "2026-10-23T12:00:00Z",
    metrics_secret_attestation: {
      environment, project_ref: retentionProjects[environment],
      name: "MOMI_CRON_HISTORY_METRICS_SECRET_KEY", present: true,
      owner: "Zac", method: "owner_dashboard_names_only", observed_at: "2026-10-22T12:00:00Z",
    },
    validation: { run_id: 11, head_sha: "a".repeat(40), receipt_sha256: "b".repeat(64) },
    before: {
      ledger_sha256: "c".repeat(64),
      objects_sha256: "d".repeat(64),
      functions_sha256: "e".repeat(64),
      versions: ["20260801000000"],
    },
    function_source_sha256: "f".repeat(64),
    migrations: [...retentionVersions[environment]],
    deferred_versions: ["20260802000000"],
    dev_receipt: environment === "dev" ? null : {
      run_id: 12, artifact_id: 21, run_attempt: 1, sha256: "1".repeat(64),
    },
  }
  return {
    approval,
    context: {
      environment,
      source_sha: approval.source_sha,
      approval_sha256: hashText(canonicalJson(approval)),
      now: Date.parse("2026-10-22T16:00:00Z"),
    },
  }
}
