import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { buildExecutionAuthorityDatabaseOwners } from "../scripts/architecture/build_execution_authority_database_owners.ts"
import { loadExecutionAuthorityDebtTargets } from "../scripts/architecture/load_execution_authority_debt_targets.ts"
import type { ExecutionAuthority, ExecutionAuthorityContext } from "../scripts/architecture/execution_authority_types.ts"
import { validateExecutionAuthority } from "../scripts/architecture/validate_execution_authority.ts"
import { validateArchitecture } from "../scripts/architecture/validate_architecture.ts"
import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { runGit } from "../scripts/dev_loop/run_git.ts"
import { compareUtf16 } from "../scripts/architecture/compare_utf16.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { buildLegacyAccessGovernanceReport } from "../scripts/constitution/build_legacy_access_governance_report.ts"
import { loadTargetAccessBaselineFingerprints } from "../scripts/constitution/load_target_access_baseline_fingerprints.ts"
import type { LegacyAccessGovernanceReport } from "../scripts/constitution/legacy_access_governance_report_types.ts"
import { validateLegacyAccessGovernanceReport } from "../scripts/constitution/validate_legacy_access_governance_report.ts"
export async function loadLegacyDebtExclusionCase() {
  const fixture = await readJson<Record<string, any>>(join(workspaceRoot, "tests/fixtures/legacy-debt-exclusion", "triage-025-slack-order-delivery-v1.json"))
  const control = await readJson<ExecutionAuthority>(join(workspaceRoot, fixture.control_grant_path))
  const baseline = await readJson<Record<string, any>>(join(workspaceRoot, "docs/service-access-debt-baseline.json"))
  const baselineText = await readFile(join(workspaceRoot, "docs/service-access-debt-baseline.json"), "utf8")
  const trustedCommit = runGit(["rev-parse", "origin/dev"])
  const trustedTree = runGit(["rev-parse", "origin/dev^{tree}"])
  const report = await readJson<LegacyAccessGovernanceReport>(join(workspaceRoot, "docs/legacy-access-governance-report.json"))
  const sourceSchema = await readJson<object>(join(workspaceRoot, "schemas/service-access-debt-baseline-v1.schema.json"))
  const reportSchema = await readJson<object>(join(workspaceRoot, "schemas/legacy-access-governance-report-v1.schema.json"))
  const trustedFingerprints = loadTargetAccessBaselineFingerprints()
  const expectedReport = buildLegacyAccessGovernanceReport({
    sourceText: baselineText, sourceSchema, trustedFingerprints,
  })
  validateLegacyAccessGovernanceReport(report, reportSchema, expectedReport)
  const executionSchema = await readJson<object>(join(workspaceRoot, "schemas/execution-authority-v1.schema.json"))
  const architecture = await validateArchitecture()
  const services = Object.fromEntries(architecture.services.map(({ manifest }) => [manifest.service_key, { database: manifest.database, provides: manifest.contracts.provides, consumes: manifest.contracts.consumes.map((item) => `${item.service}:${item.contract}`), network: manifest.network.outbound_hosts, secrets: manifest.secrets, packages: manifest.approved_packages }]))
  const context: ExecutionAuthorityContext = { root: workspaceRoot, repository: "thedoughmonster/momi-backend", baseRevision: fixture.source_revision.commit, sourceDigest: control.source_digest, services, databaseOwners: buildExecutionAuthorityDatabaseOwners(architecture.services), externalAuthorities: [], debtTargets: await loadExecutionAuthorityDebtTargets(workspaceRoot) }
  const expectedFingerprint = fixture.baseline.finding_fingerprint
  const diagnostic = (field_path: string, code: string, target: string) => ({
    fixture_id: fixture.fixture_id, field_path, code, target,
  })
  const sourceIdentity = (source: { baseline: Record<string, any>; baselineText: string; report: LegacyAccessGovernanceReport }) => {
    const expected = buildLegacyAccessGovernanceReport({
      sourceText: source.baselineText, sourceSchema, trustedFingerprints,
    })
    let reportValid = true
    try {
      validateLegacyAccessGovernanceReport(source.report, reportSchema, expected)
    } catch {
      reportValid = false
    }
    return {
      source: expected.source,
      findingsSha: expected.findings_sha256,
      reportDigest: expected.report_digest,
      trustedCommit,
      trustedTree,
      findingsValid: source.report.findings_sha256 === expected.findings_sha256,
      reportValid,
    }
  }
  const verify = async (value = fixture, grant = control, sources = {
    baseline, baselineText, report,
  }) => {
    const diagnostics: Array<Record<string, string>> = []
    const diagnosticKey = (item: Record<string, string>) =>
      [item.fixture_id, item.field_path, item.code, item.target].join("\0")
    const sorted = () => [...new Map(diagnostics.map((item) =>
      [diagnosticKey(item), item] as const)).values()].sort((left, right) =>
      compareUtf16(diagnosticKey(left), diagnosticKey(right)))
    const shape = ["baseline", "control_grant_path", "fixture_digest", "fixture_id", "negative_control_pointer", "negative_debt_pointer", "positive_control_pointer", "report", "schema_version", "source_revision"]
    if (value.schema_version !== "legacy-debt-exclusion-fixture/v1")
      diagnostics.push(diagnostic("/schema_version", "debt_exclusion_fixture_schema_invalid",
        "legacy-debt-exclusion-fixture/v1"))
    for (const key of Object.keys(value).sort()) if (!shape.includes(key))
      diagnostics.push(diagnostic(`/${key}`, "debt_exclusion_fixture_schema_invalid",
        "legacy-debt-exclusion-fixture/v1"))
    for (const key of shape) if (!(key in value))
      diagnostics.push(diagnostic(`/${key}`, "debt_exclusion_fixture_schema_invalid",
        "legacy-debt-exclusion-fixture/v1"))
    const objects: Array<[string, any, string[]]> = [["/source_revision", value.source_revision, ["repository", "commit", "tree"]], ["/baseline", value.baseline, ["path", "schema_version", "git_blob", "sha256", "finding_fingerprint"]], ["/report", value.report, ["path", "schema_version", "findings_sha256", "report_digest", "expected_projection"]], ["/report/expected_projection", value.report?.expected_projection, ["fingerprint", "rule_version", "rule_id", "subject", "consumer_service", "owner_service", "object", "access_mode", "reference_count", "sql_source_hash"]], ["/report/expected_projection/object", value.report?.expected_projection?.object, ["kind", "identity"]]]
    for (const [path, object, keys] of objects) {
      if (!object || typeof object !== "object" || Array.isArray(object)) { diagnostics.push(diagnostic(path, "debt_exclusion_fixture_schema_invalid", "legacy-debt-exclusion-fixture/v1")); continue }
      for (const key of Object.keys(object).sort()) if (!keys.includes(key)) diagnostics.push(diagnostic(`${path}/${key}`, "debt_exclusion_fixture_schema_invalid", "legacy-debt-exclusion-fixture/v1"))
      for (const key of keys) if (!(key in object)) diagnostics.push(diagnostic(`${path}/${key}`, "debt_exclusion_fixture_schema_invalid", "legacy-debt-exclusion-fixture/v1"))
    }
    const stringFields = ["/schema_version", "/fixture_id", "/control_grant_path", "/positive_control_pointer", "/negative_debt_pointer", "/negative_control_pointer", "/source_revision/repository", "/source_revision/commit", "/source_revision/tree", "/baseline/path", "/baseline/schema_version", "/baseline/git_blob", "/baseline/sha256", "/baseline/finding_fingerprint", "/report/path", "/report/schema_version", "/report/findings_sha256", "/report/report_digest", "/report/expected_projection/fingerprint", "/report/expected_projection/rule_id", "/report/expected_projection/subject", "/report/expected_projection/consumer_service", "/report/expected_projection/owner_service", "/report/expected_projection/access_mode", "/report/expected_projection/reference_count", "/report/expected_projection/sql_source_hash", "/report/expected_projection/object/kind", "/report/expected_projection/object/identity", "/fixture_digest"]
    for (const path of stringFields) {
      const actual = path.slice(1).split("/").reduce((item, key) => item?.[key], value)
      if (typeof actual !== "string" && !diagnostics.some((item) => item.field_path === path)) diagnostics.push(diagnostic(path, "debt_exclusion_fixture_schema_invalid", "legacy-debt-exclusion-fixture/v1"))
    }
    const ruleVersion = value.report?.expected_projection?.rule_version
    if (typeof ruleVersion !== "number" && !diagnostics.some((item) => item.field_path === "/report/expected_projection/rule_version")) diagnostics.push(diagnostic("/report/expected_projection/rule_version", "debt_exclusion_fixture_schema_invalid", "legacy-debt-exclusion-fixture/v1"))
    if (diagnostics.length) return { diagnostics: sorted(), authority: [] }
    const { fixture_digest: _digest, ...withoutDigest } = value
    if (value.fixture_digest !== createHash("sha256").update(canonicalJson(withoutDigest)).digest("hex")) diagnostics.push(diagnostic("/fixture_digest", "debt_exclusion_source_identity_mismatch", "fixture_digest"))
    if (diagnostics.length) return { diagnostics: sorted(), authority: [] }
    const actual = sourceIdentity(sources)
    if (!actual.findingsValid) diagnostics.push(diagnostic("/report/findings_sha256", "debt_exclusion_source_identity_mismatch", "report.findings_sha256"))
    if (!actual.reportValid) diagnostics.push(diagnostic("/report/report_digest", "debt_exclusion_source_identity_mismatch", "report.report_digest"))
    const identity: Array<[string, string, string]> = [["/source_revision/commit", value.source_revision.commit, actual.trustedCommit], ["/source_revision/tree", value.source_revision.tree, actual.trustedTree], ["/baseline/git_blob", value.baseline.git_blob, actual.source.git_blob], ["/baseline/sha256", value.baseline.sha256, actual.source.sha256], ["/report/findings_sha256", value.report.findings_sha256, actual.findingsSha], ["/report/report_digest", value.report.report_digest, actual.reportDigest]]
    diagnostics.push(...identity.filter(([, actual, expected]) => actual !== expected).map(([path]) => diagnostic(path, "debt_exclusion_source_identity_mismatch", path.slice(1).replaceAll("/", "."))))
    const selectedFingerprint = value.baseline.finding_fingerprint
    const findings = sources.baseline.findings.filter((item: any) =>
      item.fingerprint === selectedFingerprint)
    if (findings.length === 0) diagnostics.push(diagnostic(
      "/baseline/finding_fingerprint", "debt_exclusion_finding_missing", expectedFingerprint))
    if (findings.length > 1) diagnostics.push(diagnostic(
      "/baseline/finding_fingerprint", "debt_exclusion_finding_duplicate", expectedFingerprint))
    const row = sources.report.findings.filter((item) => item.fingerprint === expectedFingerprint)
    if (row.length !== 1) diagnostics.push(diagnostic(
      "/report/expected_projection", "debt_exclusion_source_identity_mismatch",
      "report.expected_projection"))
    if (findings.length !== 1 || row.length !== 1)
      return { diagnostics: sorted(), authority: [] }
    const finding = findings[0]
    const projection = { fingerprint: finding.fingerprint, rule_version: finding.rule_version, rule_id: finding.rule_id, subject: finding.subject, consumer_service: finding.evidence.consumer_service, owner_service: finding.evidence.owner_service, object: { kind: "relation", identity: finding.evidence.relation }, access_mode: finding.evidence.access, reference_count: finding.evidence.reference_count, sql_source_hash: finding.evidence.sql_source_hash }
    if (canonicalJson(projection) !== canonicalJson(value.report.expected_projection) || canonicalJson(projection) !== canonicalJson(row[0])) diagnostics.push(diagnostic("/report/expected_projection", "debt_exclusion_source_identity_mismatch", "report.expected_projection"))
    const reads = grant.database?.read ?? []
    const controls = reads.filter((item) => canonicalJson(item) === canonicalJson(control.database.read[0]))
    if (controls.length !== 1) diagnostics.push(diagnostic("/database/read/0", "debt_exclusion_positive_control_missing", "momi_alerting.slack_delivery_attempts"))
    if (diagnostics.length) return { diagnostics: sorted(), authority: [] }
    return { diagnostics: sorted(), authority: await validateExecutionAuthority(
      grant, executionSchema, context), finding, row: row[0], projection }
  }
  return { fixture, control, baseline, baselineText, report, context, executionSchema,
    expectedFingerprint, verify }
}
