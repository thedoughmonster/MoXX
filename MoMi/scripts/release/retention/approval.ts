import { canonicalJson } from "../../dev_loop/canonical_json.ts"
import { hashText } from "../../dev_loop/hash_text.ts"
import { retentionProjects, retentionSunset, retentionVersions } from "./policy.ts"
import type { RetentionApproval, RetentionApprovalContext } from "./types.ts"

export function approveRetention(
  value: unknown,
  context: RetentionApprovalContext,
): RetentionApproval {
  const fail = (reason: string): never => {
    throw new Error(`Invalid retention release approval: ${reason}`)
  }
  const record = (input: unknown, keys: string[], label: string) => {
    if (input === null || typeof input !== "object" ||
      Object.getPrototypeOf(input) !== Object.prototype) return fail(label)
    const actual = Reflect.ownKeys(input)
    if (actual.length !== keys.length || keys.some((key) =>
      !Object.hasOwn(input, key) ||
      !Object.getOwnPropertyDescriptor(input, key)!.enumerable ||
      !Object.hasOwn(Object.getOwnPropertyDescriptor(input, key)!, "value")
    )) return fail(`${label} fields`)
    return input as Record<string, unknown>
  }
  const hex = (input: unknown, length: number) =>
    typeof input === "string" && new RegExp(`^[0-9a-f]{${length}}$`).test(input)
  const runId = (input: unknown) =>
    typeof input === "number" && Number.isSafeInteger(input) && input > 0
  const versionList = (input: unknown, label: string): string[] => {
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype ||
      Reflect.ownKeys(input).length !== input.length + 1) return fail(`${label} versions`)
    for (let index = 0; index < input.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(input, index)
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value") ||
        typeof descriptor.value !== "string" || !/^\d{14}$/.test(descriptor.value) ||
        (index > 0 && input[index - 1] >= descriptor.value)) return fail(`${label} versions`)
    }
    return input
  }
  const timestamp = (input: unknown) => {
    if (typeof input !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input)) {
      return fail("UTC ISO timestamp")
    }
    const milliseconds = Date.parse(input)
    const normalized = input.includes(".") ? input : input.replace("Z", ".000Z")
    if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== normalized) {
      return fail("calendar timestamp")
    }
    return milliseconds
  }
  record(context, ["environment", "source_sha", "approval_sha256", "now"], "context")
  if ((context.environment !== "dev" && context.environment !== "prod") ||
    !hex(context.source_sha, 40) || !hex(context.approval_sha256, 64) ||
    typeof context.now !== "number" || !Number.isSafeInteger(context.now)) {
    return fail("context values")
  }
  const approval = record(value, [
    "schema_version", "kind", "environment", "project_ref", "source_sha",
    "issued_at", "expires_at", "validation", "before", "function_source_sha256",
    "migrations", "deferred_versions", "dev_receipt", "metrics_secret_attestation",
  ], "approval")
  if (approval.schema_version !== 1 || approval.kind !== "retention-release-exception" ||
    approval.environment !== context.environment ||
    approval.project_ref !== retentionProjects[context.environment] ||
    approval.source_sha !== context.source_sha || !hex(approval.function_source_sha256, 64)) {
    return fail("identity or function source")
  }
  const validation = record(approval.validation,
    ["run_id", "head_sha", "receipt_sha256"], "validation")
  if (!runId(validation.run_id) || !hex(validation.head_sha, 40) ||
    !hex(validation.receipt_sha256, 64)) return fail("validation receipt")
  const before = record(approval.before,
    ["ledger_sha256", "objects_sha256", "functions_sha256", "versions"], "before")
  if ([before.ledger_sha256, before.objects_sha256, before.functions_sha256].some(
    (digest) => !hex(digest, 64),
  )) return fail("before hashes")
  if (context.environment === "dev") {
    if (approval.dev_receipt !== null) return fail("development receipt must be null")
  } else {
    const dev = record(approval.dev_receipt,
      ["run_id", "artifact_id", "run_attempt", "sha256"], "development receipt")
    if (!runId(dev.run_id) || !runId(dev.artifact_id) || !runId(dev.run_attempt) ||
      !hex(dev.sha256, 64)) return fail("development receipt values")
  }
  const versions = retentionVersions[context.environment]
  const migrations = versionList(approval.migrations, "selected")
  const existing = new Set(versionList(before.versions, "before"))
  const deferred = new Set(versionList(approval.deferred_versions, "deferred"))
  if (migrations.length !== versions.length ||
    versions.some((version, index) => migrations[index] !== version) ||
    migrations.some((version) => existing.has(version) || deferred.has(version)) ||
    [...deferred].some((version) => existing.has(version))) {
    return fail("exact ordered disjoint migration scope")
  }
  const issued = timestamp(approval.issued_at)
  const expires = timestamp(approval.expires_at)
  if (issued > context.now || expires <= context.now || expires <= issued ||
    expires - issued > 86_400_000 || expires > Date.parse(retentionSunset)) {
    return fail("approval validity window")
  }
  const attestation = record(approval.metrics_secret_attestation,
    ["environment", "project_ref", "name", "present", "owner", "method", "observed_at"],
    "metrics secret attestation")
  if (attestation.environment !== approval.environment || attestation.project_ref !== approval.project_ref ||
    attestation.name !== "MOMI_CRON_HISTORY_METRICS_SECRET_KEY" || attestation.present !== true ||
    attestation.owner !== "Zac" || attestation.method !== "owner_dashboard_names_only") {
    return fail("metrics secret attestation identity")
  }
  const observed = timestamp(attestation.observed_at)
  if (observed > issued || observed > context.now ||
    context.now - observed >= 86_400_000 || expires - observed > 86_400_000) {
    return fail("metrics secret attestation freshness")
  }
  if (hashText(canonicalJson(approval)) !== context.approval_sha256) {
    return fail("protected approval hash mismatch")
  }
  return structuredClone(approval) as RetentionApproval
}
