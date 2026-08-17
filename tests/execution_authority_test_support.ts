import { join } from "node:path"

import type {
  ExecutionAuthority,
  ExecutionAuthorityContext,
} from "../scripts/architecture/execution_authority_types.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { readJson } from "../scripts/architecture/read_json.ts"

export const fixtureRoot = join(
  workspaceRoot, "tests", "fixtures", "execution-authority",
)
export const schema = await readJson<object>(join(
  workspaceRoot, "schemas", "execution-authority-v1.schema.json",
))
export const positive = await readJson<ExecutionAuthority>(
  join(fixtureRoot, "positive.json"),
)
export const context: ExecutionAuthorityContext = {
  root: workspaceRoot,
  repository: "thedoughmonster/momi-backend",
  baseRevision: "99c8a6dd0f5306fe9a450e1d1e0ba256bb1931f8",
  sourceDigest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  services: {
    "preorder-operations": {
      database: { read: ["momi_orders"], write: ["momi_orders"] },
      provides: [],
      consumes: ["toast-data-acquisition:momi.toast_order_api.v1"],
      network: ["example.com"],
      secrets: ["MOMI_TEST_SECRET"],
      packages: ["@momi/test-contract"],
    },
    "toast-data-acquisition": {
      database: { read: ["toast_raw"], write: ["toast_raw"] },
      provides: ["momi.toast_order_api.v1"],
      consumes: [], network: [], secrets: [], packages: [],
    },
  },
  databaseOwners: {
    relations: {
      "momi_orders.order_headers": ["preorder-operations"],
      "momi_orders.order_items": ["preorder-operations"],
      "toast_raw.orders": ["toast-data-acquisition"],
    },
    routines: {},
    schemas: {
      momi_orders: ["preorder-operations"],
      toast_raw: ["toast-data-acquisition"],
    },
  },
  externalAuthorities: [
    "github.contents:read:thedoughmonster/momi-backend",
  ],
  debtTargets: ["legacy.private_table"],
}
