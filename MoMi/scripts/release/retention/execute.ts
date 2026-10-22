import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { workspaceRoot } from "../../architecture/paths.ts"
import { validateArchitecture } from "../../architecture/validate_architecture.ts"
import { deployFunctions } from "../../deploy/deploy_functions.ts"
import { selectFunctions } from "../../deploy/select_functions.ts"
import { linkProject } from "../../deploy/link_project.ts"
import { runSupabase } from "../../deploy/run_supabase.ts"
import { assertLinkedProjectRef } from "../assert_linked_project_ref.ts"
import { runCommand } from "../run_command.ts"
import { approveRetention } from "./approval.ts"
import { assertRetentionAfter } from "./assert_after.ts"
import { assertRetentionAppliedSources } from "./assert_applied_sources.ts"
import { assertRetentionConfiguration } from "./assert_configuration.ts"
import { assertRetentionSnapshot, type RetentionSnapshot } from "./assert_snapshot.ts"
import { buildRetentionTransaction } from "./build_transaction.ts"
import { retentionFunctionInventory } from "./function_inventory.ts"
import { loadRetentionSources } from "./load_sources.ts"
import { retentionFunctionSlug, retentionMigrations } from "./policy.ts"
import { readRetentionQuery } from "./read_query.ts"
import type { RetentionApproval } from "./types.ts"

export async function executeRetention(approval: RetentionApproval, developmentBundle?: string): Promise<void> {
  const evidence: Record<string, unknown> = { kind: "retention_exception_progress",
    environment: approval.environment, project_ref: approval.project_ref,
    source_sha: approval.source_sha, stage: "preflight", sql_outcome: "not_attempted" }
  const directory = join(workspaceRoot, ".momi")
  mkdirSync(directory, { recursive: true })
  try {
    const loaded = loadRetentionSources(workspaceRoot, approval)
    const snapshotSql = readFileSync(new URL("snapshot.sql", import.meta.url), "utf8").trim()
    linkProject(approval.project_ref)
    assertLinkedProjectRef(approval.project_ref)
    assertRetentionConfiguration(runSupabase(["secrets", "list", "--project-ref",
      approval.project_ref, "--output", "json"], true))
    const queryArgs = ["db", "query", "--linked", "--workdir", workspaceRoot, "--output", "json"]
    const before = readRetentionQuery<RetentionSnapshot>(runSupabase([...queryArgs,
      `begin read only; set local statement_timeout='3000ms'; ${snapshotSql}; commit;`], true))
    const local = readdirSync(join(workspaceRoot, "supabase/migrations"))
      .filter((name) => /^\d{14}_.*\.sql$/.test(name)).map((name) => name.slice(0, 14))
    assertRetentionSnapshot(approval, before, local)
    const functionsArgs = ["functions", "list", "--project-ref", approval.project_ref, "--output", "json"]
    const functionsBefore = retentionFunctionInventory(runSupabase(functionsArgs, true))
    if (functionsBefore.sha256 !== approval.before.functions_sha256) throw new Error("Function inventory changed")
    const sql = buildRetentionTransaction(approval, loaded.sources, snapshotSql)
    const path = join(directory, "retention-approved-transaction.sql")
    writeFileSync(path, sql, { mode: 0o600 })
    approveRetention(approval, { environment: approval.environment, source_sha: approval.source_sha,
      approval_sha256: process.env.MOMI_RETENTION_APPROVAL_SHA256 ?? "", now: Date.now() })
    evidence.stage = "sql"; evidence.sql_outcome = "uncertain"
    const result = readRetentionQuery<{ receipt: { before: RetentionSnapshot; after: RetentionSnapshot; phase: string } }>(
      runSupabase([...queryArgs, "--file", path], true)).receipt
    evidence.sql_outcome = "reported_committed"
    assertRetentionAfter(before, result.after, approval.migrations)
    const after = readRetentionQuery<RetentionSnapshot>(runSupabase([...queryArgs,
      `begin read only; set local statement_timeout='3000ms'; ${snapshotSql}; commit;`], true))
    assertRetentionAfter(before, after, approval.migrations)
    const applied = readRetentionQuery<{ sources: { version: string; name: string; sha256: string }[] }>(
      runSupabase([...queryArgs, `select jsonb_agg(jsonb_build_object('version',version,
        'name',name,'sha256',encode(sha256(convert_to(array_to_string(statements,E'\\n'),'UTF8')),'hex'))
        order by version) as sources from supabase_migrations.schema_migrations
        where version in (${approval.migrations.map((version) => `'${version}'`).join(",")})`], true))
    assertRetentionAppliedSources(approval.migrations, applied.sources)
    if (after.ledger_sha256 !== result.after.ledger_sha256 ||
        after.objects_sha256 !== result.after.objects_sha256 || result.phase !== "disarmed") {
      throw new Error("Committed retention readback changed")
    }
    evidence.sql_outcome = "verified_committed"; evidence.after_ledger_sha256 = after.ledger_sha256
    evidence.after_objects_sha256 = after.objects_sha256; evidence.stage = "function_deploy"
    approveRetention(approval, { environment: approval.environment, source_sha: approval.source_sha,
      approval_sha256: process.env.MOMI_RETENTION_APPROVAL_SHA256 ?? "", now: Date.now() })
    const selected = selectFunctions(await validateArchitecture(), ["cron-history-governance"])
    if (selected.length !== 1 || selected[0].slug !== retentionFunctionSlug) throw new Error("Governor selection changed")
    deployFunctions(approval.project_ref, selected)
    const functionsAfter = retentionFunctionInventory(runSupabase(functionsArgs, true))
    const governor = functionsAfter.rows.find((row) => row.slug === retentionFunctionSlug)
    if (functionsBefore.unrelated !== functionsAfter.unrelated || governor?.status !== "ACTIVE" ||
        governor.verify_jwt !== false || (approval.environment === "prod" &&
          governor.ezbr_sha256 !== developmentBundle)) throw new Error("Governor deployment inventory changed unexpectedly")
    const response = await fetch(`https://${approval.project_ref}.supabase.co/functions/v1/${retentionFunctionSlug}`,
      { signal: AbortSignal.timeout(15000) })
    const health = await response.json() as { disposition?: string; ok?: boolean }
    if (response.status !== 200 || !health.ok || health.disposition !== "configured") throw new Error("Governor not configured")
    const policy = readRetentionQuery<{ phase: string }>(runSupabase([...queryArgs,
      "select phase from momi_cron_history.policy_control where singleton"], true))
    if (policy.phase !== "disarmed") throw new Error("Governor is not disarmed")
    const receipt = { kind: "retention_exception_release", schema_version: 1,
      environment: approval.environment, project_ref: approval.project_ref,
      source_tree: runCommand("git", ["rev-parse", "HEAD^{tree}"], { capture: true }).stdout.trim(),
      source_sha: approval.source_sha, function_source_sha256: loaded.sourceDigest,
      migrations: approval.migrations, migration_hashes: approval.migrations.map((version) => retentionMigrations[version]),
      approval_sha256: process.env.MOMI_RETENTION_APPROVAL_SHA256, before: approval.before,
      after: { ledger_sha256: after.ledger_sha256, objects_sha256: after.objects_sha256,
        versions: after.ledger.map((row) => row.version), functions_sha256: functionsAfter.sha256 },
      phase: policy.phase, governor, completed_at: new Date().toISOString(),
      run_id: Number(process.env.GITHUB_RUN_ID), run_attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
      workflow_ref: process.env.GITHUB_WORKFLOW_REF }
    writeFileSync(join(directory, "retention-release-receipt.json"), JSON.stringify(receipt, null, 2))
    evidence.stage = "complete"
  } catch {
    throw new Error(`Retention exception stopped during ${evidence.stage}; reconcile state before retry`)
  } finally {
    writeFileSync(join(directory, "retention-release-evidence.json"), JSON.stringify(evidence, null, 2))
  }
}
