import { execFileSync } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { buildFunctionAttestations } from "./build_function_attestations.ts"
import type { AdvisorResult, DeploymentContext, InventoryResult, ProbeResult } from "./types.ts"

export async function writeReleaseRecord(
  context: DeploymentContext,
  inventory: InventoryResult,
  probes: ProbeResult[],
  advisors: AdvisorResult,
): Promise<string> {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  const directory = join(workspaceRoot, ".momi", "releases")
  const path = join(directory, `${context.environment}-${sha}.json`)
  const functions = await buildFunctionAttestations(context.functions, inventory.hosted)
  const record = {
    schema_version: 2,
    environment: context.environment,
    project_ref: context.project_ref,
    service: context.service,
    commit_sha: sha,
    created_at: new Date().toISOString(),
    functions,
    inventory,
    probes,
    advisors: {
      security_count: advisors.security.length,
      performance_count: advisors.performance.length,
    },
  }
  await mkdir(directory, { recursive: true })
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8")
  return path
}
