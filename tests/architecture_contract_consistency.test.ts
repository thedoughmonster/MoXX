import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { classifyServiceStatus } from "../scripts/architecture/classify_service_status.ts"
type Sources = {
  serviceSchema: string
  functionSchema: string
  serviceContract: string
  functionContract: string
  statusContract: string
}
const sources: Sources = {
  serviceSchema: await readFile("schemas/service-manifest-v1.schema.json", "utf8"),
  functionSchema: await readFile("schemas/function-manifest-v1.schema.json", "utf8"),
  serviceContract: await readFile("docs/contracts/service-manifest-v1.md", "utf8"),
  functionContract: await readFile("docs/contracts/edge-function-manifest-v1.md", "utf8"),
  statusContract: await readFile("docs/contracts/service-status-v1.md", "utf8"),
}
const diagnostics = {
  service: "TRIAGE-010/service-type-required: " +
    "schemas/service-manifest-v1.schema.json#/required ↔ " +
    "docs/contracts/service-manifest-v1.md#Identity mandatory service_type",
  closed: "TRIAGE-010/function-closed-fields: " +
    "schemas/function-manifest-v1.schema.json#/additionalProperties and " +
    "schemas/function-manifest-v1.schema.json#/properties/probe/additionalProperties ↔ " +
    "docs/contracts/edge-function-manifest-v1.md#Authority Declaration strict v1 closed boundaries",
  boundary: "TRIAGE-010/function-boundary-enum: " +
    "schemas/function-manifest-v1.schema.json#/properties/boundary/enum ↔ " +
    "docs/contracts/edge-function-manifest-v1.md#Logical Identity boundary bullet",
  status: "TRIAGE-010/implementation-status-vocabulary: " +
    "schemas/service-manifest-v1.schema.json#/properties/implementation_status/enum + " +
    "scripts/architecture/classify_service_status.ts ↔ " +
    "docs/contracts/service-status-v1.md#Transitional Absence And Availability table",
} as const
function findContractDrift(input: Sources): string[] {
  const service = JSON.parse(input.serviceSchema)
  const edge = JSON.parse(input.functionSchema)
  const identity = input.serviceContract.split("## Identity\n")[1]
    ?.split("\n## ")[0] ?? ""
  const requiredTypes = (service.required as string[])
    .filter((value) => value === "service_type")
  const documentedTypes = identity.includes("Every service declares `service_type`")
    ? ["service_type"] : []
  const authority = input.functionContract.split("## Authority Declaration\n")[1]
    ?.split("\n## ")[0] ?? ""
  const schemaClosures = [edge.additionalProperties === false,
    edge.properties?.probe?.additionalProperties === false]
  const documentedClosures = authority.includes(
    "Fields not declared by the v1 schema\nare invalid at every closed object boundary.",
  ) ? [true, true] : [false, false]
  const logical = input.functionContract.split("## Logical Identity\n")[1]
    ?.split("\n## ")[0] ?? ""
  const boundaryBullet = logical.match(/- `boundary`: one of ([\s\S]*?)\.\n/u)?.[1] ?? ""
  const documentedBoundaries = [...boundaryBullet.matchAll(/`([^`]+)`/gu)]
    .map((match) => match[1]).sort()
  const schemaBoundaries = [...edge.properties.boundary.enum as string[]].sort()
  const section = input.statusContract
    .split("## Transitional Absence And Availability\n")[1]
    ?.split("\n## ")[0] ?? ""
  const documentedStatuses = [...section.matchAll(
    /^\| (?:absent \(`(unclassified)`\)|`([^`]+)`) \| `([^`]+)` \|$/gmu,
  )].map((match) => (match[1] ?? match[2]) + ":" + match[3]).sort()
  const statuses = service.properties.implementation_status.enum as string[]
  const classifiedStatuses = ["unclassified", ...statuses].map((status) => {
    const result = classifyServiceStatus(status === "unclassified" ? undefined :
      status as Parameters<typeof classifyServiceStatus>[0])
    return result.implementation + ":" + result.availability
  }).sort()
  const invariants = [{
    id: "TRIAGE-010/service-type-required", diagnostic: diagnostics.service,
    actual: requiredTypes, expected: documentedTypes,
  }, {
    id: "TRIAGE-010/function-closed-fields", diagnostic: diagnostics.closed,
    actual: schemaClosures, expected: documentedClosures,
  }, {
    id: "TRIAGE-010/function-boundary-enum", diagnostic: diagnostics.boundary,
    actual: schemaBoundaries, expected: documentedBoundaries,
  }, {
    id: "TRIAGE-010/implementation-status-vocabulary", diagnostic: diagnostics.status,
    actual: classifiedStatuses, expected: documentedStatuses,
  }]
  return invariants.filter(({ actual, expected }) =>
    JSON.stringify(actual) !== JSON.stringify(expected)
  ).map(({ diagnostic }) => diagnostic)
}
const cases: Array<{
  id: keyof typeof diagnostics
  source: keyof Sources
  before: string
  after: string
}> = [{
  id: "service", source: "serviceSchema",
  before: '"kind", "service_type",', after: '"kind",',
}, {
  id: "closed", source: "functionSchema",
  before: '"probe": {\n      "type": "object",\n      "additionalProperties": false',
  after: '"probe": {\n      "type": "object",\n      "additionalProperties": true',
}, {
  id: "boundary", source: "functionContract",
  before: '`trello_inbound`,\n  ', after: "",
}, {
  id: "status", source: "statusContract",
  before: '| `implemented` | `not_asserted` |',
  after: '| `implemented` | `unavailable` |',
}]
test("keeps architecture contract sources consistent", () => {
  for (const scenario of cases) {
    assert.deepEqual(findContractDrift(sources), [], `${scenario.id} current sources`)
    assert.notEqual(
      sources[scenario.source].indexOf(scenario.before), -1, scenario.id,
    )
    const drifted = {
      ...sources,
      [scenario.source]: sources[scenario.source].replace(
        scenario.before, scenario.after,
      ),
    }
    assert.deepEqual(findContractDrift(drifted), [diagnostics[scenario.id]])
  }
})
