import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { Architecture, LoadedService } from
  "../scripts/architecture/types.ts"

const owner = "preorder-operations"
const square = "square-payment-acquisition"
const squareContract = {
  provider_service: square, contract: "payments.square.v1",
}
const ownerContract = {
  provider_service: owner, contract: "preorder.quote.v1",
}
const tests = {
  local_unit: "tests/unit.test.ts",
  local_integration: "tests/integration.test.ts",
  provider_contract: "tests/provider.test.ts",
  consumer_contract: "tests/consumer.test.ts",
  cross_service_integration: "tests/cross.test.ts",
  mandatory_global: "tests/global.test.ts",
  risk_triggered: "tests/risk.test.ts",
} as const

export async function createServiceTestImpactFixture(root: string): Promise<{
  architecture: Pick<Architecture, "services">
  authority: Record<string, unknown>
}> {
  await mkdir(join(root, "tests"), { recursive: true })
  await Promise.all(Object.values(tests).map((path) =>
    writeFile(join(root, path), "// fixture\n")))
  const metadata = {
    schema_version: 1 as const,
    owner_service: owner,
    categories: {
      local_unit: [{ id: `${owner}:local_unit:quote:v1`,
        test: tests.local_unit, reason: "Unit boundary.", services: [owner],
        contracts: [], triggers: [] }],
      local_integration: [{ id: `${owner}:local_integration:config:v1`,
        test: tests.local_integration, reason: "Owned integration.",
        services: [owner], contracts: [], triggers: [] }],
      provider_contract: [{ id: `${owner}:provider_contract:quote:v1`,
        test: tests.provider_contract, reason: "Provided quote contract.",
        services: [owner], contracts: [ownerContract], triggers: [] }],
      consumer_contract: [{ id: `${owner}:consumer_contract:square:v1`,
        test: tests.consumer_contract, reason: "Consumed Square contract.",
        services: [owner, square], contracts: [squareContract], triggers: [] }],
      cross_service_integration: [{
        id: `${owner}:cross_service_integration:square:v1`,
        test: tests.cross_service_integration, reason: "Connected services.",
        services: [owner, square], contracts: [squareContract], triggers: [],
      }],
      mandatory_global: [{ id: `${owner}:mandatory_global:protocol:v1`,
        test: tests.mandatory_global, reason: "Global protocol.",
        services: [owner], contracts: [], triggers: [] }, {
        id: `${owner}:mandatory_global:unit-alias:v1`,
        test: tests.local_unit, reason: "Same test, global reason.",
        services: [owner], contracts: [], triggers: [] }],
      risk_triggered: [{ id: `${owner}:risk_triggered:migration:v1`,
        test: tests.risk_triggered, reason: "Migration risk.",
        services: [owner], contracts: [], triggers: ["migration" as const] }],
    },
  }
  const services = [{ directory: `/repo/services/${owner}`, manifest: {
    service_key: owner, contracts: {
      provides: [ownerContract.contract],
      consumes: [{ service: square, contract: squareContract.contract }],
    }, test_impact: metadata,
  } }, { directory: `/repo/services/${square}`, manifest: {
    service_key: square, contracts: {
      provides: [squareContract.contract], consumes: [],
    },
  } }] as unknown as LoadedService[]
  return { architecture: { services }, authority: {
    filesystem_write: [`services/${owner}/`], database: [], network: [],
    secrets: [], provider: [], runtime: [], deployment: [],
  } }
}
