import type { RepositoryDiagnosticV1 } from "./types.ts"

export function manifestDiagnostic(
  path: string,
  schema: string,
  rationale: string,
): RepositoryDiagnosticV1 | null {
  const service = path.match(/^services\/([^/]+)\/service\.json$/u)
  const fn = path.match(/^services\/([^/]+)\/functions\/([^/]+)\/function\.json$/u)
  if (!service && !fn) return null
  const owner = (service ?? fn)![1]
  const expected = service
    ? `Make the affected service manifest satisfy ${schema} with service_key ${owner}.`
    : `Make each affected function manifest satisfy ${schema} with owner_service ${owner}.`
  const detail = rationale.startsWith(`${path}: `)
    ? rationale.slice(path.length + 2)
    : rationale
  return {
    schema_version: 1,
    rule_id: "MANIFEST_SCHEMA_INVALID",
    enforcement: "hard_stop",
    location: { path },
    violated_rule: "Service and function manifests must satisfy their closed repository schemas.",
    rationale: detail.slice(0, 500),
    expected,
    repair: { kind: "none" },
    validation_command: "pnpm architecture:check",
    fingerprint: {
      group: {
        rule_id: "MANIFEST_SCHEMA_INVALID",
        schema,
        owner_service: owner,
        failure_detail: detail,
      },
      instance: { path },
    },
  }
}
