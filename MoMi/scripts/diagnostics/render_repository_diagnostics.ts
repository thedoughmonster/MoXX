import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { hashText } from "../dev_loop/hash_text.ts"
import { redactValue } from "../dev_loop/redact_value.ts"
import { sanitizeDiagnosticText } from "./sanitize_diagnostic_text.ts"
import type { RepositoryDiagnosticV1 } from "./types.ts"

export function renderRepositoryDiagnostics(
  diagnostics: readonly RepositoryDiagnosticV1[],
): string {
  const groups = new Map<string, {
    diagnostic: RepositoryDiagnosticV1
    fingerprintKey: string
    instances: Map<string, Map<string, RepositoryDiagnosticV1["location"]>>
  }>()
  const sorted = [...diagnostics].sort((left, right) => {
    const leftKey = canonicalJson(left)
    const rightKey = canonicalJson(right)
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
  })
  for (const diagnostic of sorted) {
    const fingerprintGroup = redactValue(Object.fromEntries(
      Object.entries(diagnostic.fingerprint.group).map(([key, value]) => [
        sanitizeDiagnosticText(key),
        typeof value === "string" ? sanitizeDiagnosticText(value) : value,
      ]),
    ))
    const fingerprintInstance = redactValue(Object.fromEntries(
      Object.entries(diagnostic.fingerprint.instance).map(([key, value]) => [
        sanitizeDiagnosticText(key),
        typeof value === "string" ? sanitizeDiagnosticText(value) : value,
      ]),
    ))
    const fingerprintKey = canonicalJson({
      schema_version: diagnostic.schema_version,
      rule_id: sanitizeDiagnosticText(diagnostic.rule_id),
      enforcement: diagnostic.enforcement,
      fingerprint: fingerprintGroup,
    })
    const groupKey = canonicalJson({
      fingerprint: fingerprintKey,
      violated_rule: sanitizeDiagnosticText(diagnostic.violated_rule),
      rationale: diagnostic.rationale && sanitizeDiagnosticText(diagnostic.rationale),
      expected: sanitizeDiagnosticText(diagnostic.expected),
      repair: diagnostic.repair.kind === "command"
        ? { kind: "command", command: sanitizeDiagnosticText(diagnostic.repair.command) }
        : diagnostic.repair,
      validation_command: sanitizeDiagnosticText(diagnostic.validation_command),
    })
    let group = groups.get(groupKey)
    if (!group) {
      group = { diagnostic, fingerprintKey, instances: new Map() }
      groups.set(groupKey, group)
    }
    const instanceKey = canonicalJson(fingerprintInstance)
    let locations = group.instances.get(instanceKey)
    if (!locations) {
      locations = new Map()
      group.instances.set(instanceKey, locations)
    }
    const location = diagnostic.location && {
      ...diagnostic.location,
      path: sanitizeDiagnosticText(diagnostic.location.path),
    }
    const locationKey = location ? canonicalJson(location) : ""
    locations.set(locationKey, location)
  }
  const lines: string[] = []
  for (const [groupKey, group] of [...groups.entries()].sort()) {
    const item = group.diagnostic
    const count = group.instances.size
    lines.push(
      `[${item.enforcement}] ${sanitizeDiagnosticText(item.rule_id)} ` +
        `(${count} ${count === 1 ? "instance" : "instances"}; ` +
        `fingerprint sha256:${hashText(group.fingerprintKey)})`,
      `  rule: ${sanitizeDiagnosticText(item.violated_rule)}`,
    )
    if (item.rationale) {
      lines.push(`  rationale: ${sanitizeDiagnosticText(item.rationale)}`)
    }
    lines.push(`  affected:`)
    for (const [instanceKey, locations] of [...group.instances.entries()].sort()) {
      const fingerprint = `sha256:${hashText(instanceKey)}`
      for (const [, location] of [...locations.entries()].sort()) {
        if (!location) {
          lines.push(`  - location unavailable [${fingerprint}]`)
          continue
        }
        const suffix = location.line === undefined ? "" :
          `:${location.line}${location.column === undefined ? "" : `:${location.column}`}`
        lines.push(`  - ${sanitizeDiagnosticText(location.path)}${suffix} [${fingerprint}]`)
      }
    }
    lines.push(
      `  expected: ${sanitizeDiagnosticText(item.expected)}`,
      item.repair.kind === "command"
        ? `  fix: ${sanitizeDiagnosticText(item.repair.command)}`
        : "  fix: none (no safe deterministic repair)",
      `  validate: ${sanitizeDiagnosticText(item.validation_command)}`,
      "",
    )
  }
  return lines.length === 0 ? "" : `${lines.slice(0, -1).join("\n")}\n`
}
