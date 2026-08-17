import Ajv2020 from "ajv/dist/2020.js"

import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { findExecutionAuthorityBoundaryDiagnostics } from
  "./find_execution_authority_boundary_diagnostics.ts"
import { findExecutionAuthorityOverlapDiagnostics } from
  "./find_execution_authority_overlap_diagnostics.ts"
import { inspectExecutionAuthorityPath } from
  "./inspect_execution_authority_path.ts"
import type {
  ExecutionAuthority,
  ExecutionAuthorityContext,
  ExecutionAuthorityDiagnostic,
} from "./execution_authority_types.ts"

export async function validateExecutionAuthority(
  value: unknown,
  schema: object,
  context: ExecutionAuthorityContext,
): Promise<ExecutionAuthorityDiagnostic[]> {
  const raw = value as Partial<ExecutionAuthority>
  const grantId = typeof raw?.grant_id === "string" ? raw.grant_id : "<unknown>"
  const diagnostics: ExecutionAuthorityDiagnostic[] = []
  const report = (field_path: string, code: string, target: string) => {
    diagnostics.push({ grant_id: grantId, field_path, code, target,
      message: `${code}: ${target}` })
  }
  if (raw?.schema_version !== "execution-authority/v1") {
    report("/schema_version", "unknown_version", String(raw?.schema_version))
    return diagnostics
  }
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)
  if (!validate(value)) {
    for (const error of validate.errors ?? []) {
      report(error.instancePath || "/", "schema_invalid",
        `${error.keyword}:${error.message ?? "invalid"}`)
    }
  } else {
    const grant = value as ExecutionAuthority
    if (grant.repository !== context.repository) {
      report("/repository", "repository_mismatch", grant.repository)
    }
    if (grant.base_revision !== context.baseRevision) {
      report("/base_revision", "base_revision_drift", grant.base_revision)
    }
    if (grant.source_digest !== context.sourceDigest) {
      report("/source_digest", "source_digest_drift", grant.source_digest)
    }
    const stack: Array<[unknown, string]> = [[grant, ""]]
    while (stack.length > 0) {
      const [subject, path] = stack.pop()!
      if (Array.isArray(subject)) {
        const keys = subject.map((item) => canonicalJson(item))
        if (new Set(keys).size !== keys.length) {
          report(path, "collection_duplicate", path)
        }
        if (keys.some((key, index) => index > 0 && keys[index - 1] > key)) {
          report(path, "collection_unsorted", path)
        }
        subject.forEach((item, index) => stack.push([item, `${path}/${index}`]))
      } else if (subject && typeof subject === "object") {
        Object.entries(subject).forEach(([key, item]) =>
          stack.push([item, `${path}/${key}`]))
      }
    }
    for (const mode of ["read", "write"] as const) {
      for (const [index, item] of grant.filesystem[mode].entries()) {
        const code = await inspectExecutionAuthorityPath(context.root, item)
        if (code) report(`/filesystem/${mode}/${index}/path`, code, item.path)
      }
    }
    diagnostics.push(...findExecutionAuthorityBoundaryDiagnostics(grant, context))
    diagnostics.push(...findExecutionAuthorityOverlapDiagnostics(grant))
  }
  return diagnostics.sort((a, b) =>
    [a.grant_id, a.field_path, a.code, a.target].join("\0").localeCompare(
      [b.grant_id, b.field_path, b.code, b.target].join("\0"),
    ))
}
