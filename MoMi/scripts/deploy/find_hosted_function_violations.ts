import { relative, sep } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import type { Architecture } from "../architecture/types.ts"
import type { EnvironmentKey, HostedFunction } from "./types.ts"

export function findHostedFunctionViolations(
  architecture: Architecture,
  environment: EnvironmentKey,
  hosted: HostedFunction[],
  verifyJwt: ReadonlyMap<string, boolean>,
): string[] {
  const bySlug = new Map(hosted.map((item) => [item.slug, item]))
  const violations: string[] = []
  const expected = architecture.functions.map((local) => ({
    slug: local.slug,
    entrypoint: relative(
      workspaceRoot,
      local.adapter_directory,
    ).replaceAll(sep, "/") + "/index.ts",
    verifyJwt: verifyJwt.get(local.slug) ?? true,
    verifySource: "config",
  }))
  for (const authority of architecture.externalFunctionAuthorities) {
    if (!authority.environments.some((entry) => entry.name === environment)) continue
    const repository = authority.owner_repository.split("/").at(-1)
    expected.push({
      slug: authority.function_slug,
      entrypoint: `${repository}/${repository}/${authority.adapter_path}`,
      verifyJwt: authority.verify_jwt,
      verifySource: "authority",
    })
  }
  expected.sort((left, right) => left.slug.localeCompare(right.slug))

  for (const item of expected) {
    const remote = bySlug.get(item.slug)
    if (!remote) continue
    const actualEntrypoint = remote.entrypoint_path
      ?.replaceAll("\\", "/").replace(/^\.\//, "") ?? null
    const entrypointMatches = actualEntrypoint === item.entrypoint ||
      actualEntrypoint?.endsWith(`/${item.entrypoint}`) === true
    if (remote.status !== "ACTIVE") {
      violations.push(`${item.slug}: hosted status must be ACTIVE, found ${remote.status}`)
    }
    if (remote.version === null || remote.version <= 0) {
      violations.push(`${item.slug}: hosted version must be greater than zero`)
    }
    if (!entrypointMatches) {
      const expectation = item.verifySource === "config" ? "be" : "end with"
      violations.push(
        `${item.slug}: entrypoint_path must ${expectation} ${item.entrypoint}, found ${actualEntrypoint}`,
      )
    }
    if (!/^[0-9a-f]{64}$/i.test(remote.ezbr_sha256 ?? "")) {
      violations.push(`${item.slug}: ezbr_sha256 must be a 64-hex hosted bundle hash`)
    }
    if (remote.verify_jwt !== item.verifyJwt) {
      violations.push(
        `${item.slug}: verify_jwt must match ${item.verifySource} (${item.verifyJwt}), found ${remote.verify_jwt}`,
      )
    }
  }

  return violations
}
