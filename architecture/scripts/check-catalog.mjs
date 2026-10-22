import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"

const model = readFileSync(new URL("../model/system.c4", import.meta.url), "utf8")
const enrichment = readFileSync(new URL("../model/enrichment.c4", import.meta.url), "utf8")
const servicesDirectory = new URL("../../MoMi/services/", import.meta.url)
const failures = []

const manifests = readdirSync(servicesDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const path = new URL(`${entry.name}/service.json`, servicesDirectory)
    return JSON.parse(readFileSync(path, "utf8"))
  })
  .sort((left, right) => left.service_key.localeCompare(right.service_key))

const modeledCatalogServices = new Set(
  [...model.matchAll(/= (?:service|adapter) '([a-z0-9-]+)'/gu)].map((match) => match[1]),
)

for (const manifest of manifests) {
  const serviceKey = manifest.service_key
  if (!modeledCatalogServices.has(serviceKey)) {
    failures.push(`${serviceKey}: missing from architecture model`)
    continue
  }

  const declaration = model.match(
    new RegExp(`= (?:service|adapter) '${serviceKey}' \\{([^}]*)\\}`, "su"),
  )?.[1]
  assert.ok(declaration, `${serviceKey}: declaration could not be inspected`)

  const expectedLifecycle =
    manifest.implementation_status === "implemented"
      ? "implemented"
      : manifest.implementation_status === "declared"
        ? "planned"
        : "discovery"

  if (!declaration.includes(`#${expectedLifecycle}`)) {
    failures.push(`${serviceKey}: expected #${expectedLifecycle} from service manifest`)
  }

  if (manifest.lifecycle_status !== "active" && !declaration.includes("#legacy")) {
    failures.push(`${serviceKey}: ${manifest.lifecycle_status} service must carry #legacy`)
  }

  const base = `https://github.com/thedoughmonster/MoXX`
  const sourcePath = `MoMi/services/${serviceKey}`
  requireEnrichment(`${base}/tree/dev/${sourcePath}`, `${serviceKey} Code link`)
  requireEnrichment(`${base}/blob/dev/${sourcePath}/README.md`, `${serviceKey} README link`)
  requireEnrichment(`${base}/blob/dev/${sourcePath}/service.json`, `${serviceKey} Manifest link`)
}

for (const serviceKey of modeledCatalogServices) {
  if (!manifests.some((manifest) => manifest.service_key === serviceKey)) {
    failures.push(`${serviceKey}: modeled as a catalog service but has no current manifest`)
  }
}

for (const match of enrichment.matchAll(/^\s*link\s+(\S+)/gmu)) {
  if (!match[1].startsWith("https://github.com/thedoughmonster/MoXX")) {
    failures.push(`non-repository enrichment link: ${match[1]}`)
  }
}

if (failures.length > 0) {
  throw new Error(`Architecture catalog reconciliation failed:\n${failures.join("\n")}`)
}

process.stdout.write(`Reconciled ${manifests.length} MoMi service manifests with the architecture model.\n`)

function requireEnrichment(value, label) {
  if (!enrichment.includes(value)) {
    failures.push(`${label}: missing from enrichment`)
  }
}
