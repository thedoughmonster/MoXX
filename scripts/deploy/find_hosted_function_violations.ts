import { relative, sep } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import type { Architecture } from "../architecture/types.ts"
import type { HostedFunction } from "./types.ts"

export function findHostedFunctionViolations(
  architecture: Architecture,
  hosted: HostedFunction[],
  verifyJwt: ReadonlyMap<string, boolean>,
): string[] {
  const bySlug = new Map(hosted.map((item) => [item.slug, item]))
  const violations: string[] = []
  const active = [...architecture.functions].sort((left, right) =>
    left.slug.localeCompare(right.slug)
  )

  for (const local of active) {
    const remote = bySlug.get(local.slug)
    if (!remote) continue
    const expectedEntrypoint = `${relative(
      workspaceRoot,
      local.adapter_directory,
    ).replaceAll(sep, "/")}/index.ts`
    const actualEntrypoint = remote.entrypoint_path
      ?.replaceAll("\\", "/").replace(/^\.\//, "") ?? null
    const entrypointMatches = actualEntrypoint === expectedEntrypoint ||
      actualEntrypoint?.endsWith(`/${expectedEntrypoint}`) === true
    const expectedVerifyJwt = verifyJwt.get(local.slug) ?? true
    if (remote.status !== "ACTIVE") {
      violations.push(`${local.slug}: hosted status must be ACTIVE, found ${remote.status}`)
    }
    if (remote.version === null || remote.version <= 0) {
      violations.push(`${local.slug}: hosted version must be greater than zero`)
    }
    if (!entrypointMatches) {
      violations.push(
        `${local.slug}: entrypoint_path must be ${expectedEntrypoint}, found ${actualEntrypoint}`,
      )
    }
    if (!/^[0-9a-f]{64}$/i.test(remote.ezbr_sha256 ?? "")) {
      violations.push(`${local.slug}: ezbr_sha256 must be a 64-hex hosted bundle hash`)
    }
    if (remote.verify_jwt !== expectedVerifyJwt) {
      violations.push(
        `${local.slug}: verify_jwt must match config (${expectedVerifyJwt}), found ${remote.verify_jwt}`,
      )
    }
  }

  return violations
}
