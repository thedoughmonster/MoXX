import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type {
  LoadedService,
  WorkspaceConfig,
} from "../scripts/architecture/types.ts"

export type FunctionInventoryFixture = {
  root: string
  workspace: WorkspaceConfig
  services: LoadedService[]
}

export async function createFunctionInventoryFixture(
  orphan?: "service" | "adapter" | "config",
): Promise<FunctionInventoryFixture> {
  const root = await mkdtemp(join(tmpdir(), "momi-function-inventory-"))
  const serviceRoot = join(root, "services", "fixture-service")
  await mkdir(join(serviceRoot, "functions", "owned-function-v1"), { recursive: true })
  await mkdir(join(root, "supabase", "functions", "owned-function-v1"), {
    recursive: true,
  })
  if (orphan === "service") {
    await mkdir(join(serviceRoot, "functions", "orphan-function-v1"))
  }
  if (orphan === "adapter") {
    await mkdir(join(root, "supabase", "functions", "orphan-function-v1"))
  }
  const extra = orphan === "config" ? "\n[functions.orphan-function-v1]\n" : ""
  await writeFile(
    join(root, "supabase", "config.toml"),
    `[functions.owned-function-v1]\n${extra}`,
  )
  const workspace = {
    paths: {
      services: "services",
      function_adapters: "supabase/functions",
      migrations: "supabase/migrations",
      retirements: "retirements",
    },
  } as WorkspaceConfig
  const services = [{
    directory: serviceRoot,
    manifest: {
      schema_version: 1,
      service_key: "fixture-service",
      purpose: "Synthetic reverse function inventory fixture.",
      kind: "core_capability",
      lifecycle_status: "active",
      functions: ["owned-function-v1"],
      contracts: { provides: [], consumes: [] },
      database: { read: [], write: [] },
      network: { outbound_hosts: [] },
      secrets: [],
      runtime_dependencies: [],
      approved_packages: [],
    },
  }] as LoadedService[]
  return { root, workspace, services }
}
