import { readFile } from "node:fs/promises"
import { relative, sep } from "node:path"

import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { workspaceRoot } from "./architecture/paths.ts"

type Finding = { rule_id: string; subject: string; summary: string }
type Baseline = { schema_version: 1; findings: Finding[] }

const allowedTypes = new Set([
  "procurement_adapter",
  "transform",
  "raw_evidence_archive",
  "event_router",
  "dataset_owner",
  "read_facade",
  "destination_adapter",
])

const architecture = await validateArchitecture()
const findings: Finding[] = []

for (const service of architecture.services) {
  const subject = relative(workspaceRoot, `${service.directory}/service.json`)
    .replaceAll(sep, "/")
  const manifest = service.manifest as typeof service.manifest & {
    service_type?: string
    owned_dataset?: unknown
  }
  if (!manifest.service_type) {
    findings.push({
      rule_id: "service_type_missing",
      subject,
      summary: "Service manifest does not yet declare service_type.",
    })
    continue
  }
  if (!allowedTypes.has(manifest.service_type)) {
    findings.push({
      rule_id: "service_type_invalid",
      subject,
      summary: `Service manifest declares unsupported service_type ${manifest.service_type}.`,
    })
  }
  if (manifest.service_type === "dataset_owner" && !manifest.owned_dataset) {
    findings.push({
      rule_id: "dataset_owner_missing_dataset",
      subject,
      summary: "Dataset-owner service does not declare owned_dataset.",
    })
  }
}

const baselinePath = `${workspaceRoot}/docs/service-constitution-debt-baseline.json`
const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as Baseline
const baselineKeys = new Set(
  baseline.findings.map((item) => `${item.rule_id}\u0000${item.subject}`),
)
const newFindings = findings.filter((item) =>
  !baselineKeys.has(`${item.rule_id}\u0000${item.subject}`)
)
const resolved = baseline.findings.filter((item) =>
  !findings.some((current) =>
    current.rule_id === item.rule_id && current.subject === item.subject
  )
)

if (newFindings.length > 0) {
  throw new Error(
    "New service constitution findings:\n- " +
      newFindings.map((item) =>
        `${item.rule_id}: ${item.subject}: ${item.summary}`
      ).join("\n- "),
  )
}

console.log(
  `Service constitution valid: ${findings.length} known findings, ` +
    `${resolved.length} resolved findings, ${newFindings.length} new findings.`,
)
