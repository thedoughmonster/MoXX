import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export function createRepositoryFixture(root: string): void {
  mkdirSync(join(root, "node_modules/supabase"), { recursive: true })
  mkdirSync(join(root, "supabase/.temp"), { recursive: true })
  writeFileSync(join(root, "package.json"), JSON.stringify({
    packageManager: "pnpm@11.7.0",
    engines: { node: "24.14.x", pnpm: "11.7.x" },
    devDependencies: { supabase: "2.109.1" },
  }))
  writeFileSync(join(root, "workspace.json"), JSON.stringify({
    toolchain: { node: "24.14.0", pnpm: "11.7.0", supabase_cli: "2.109.1" },
    environments: {
      dev: { branch: "dev", project_ref: "xtbraqnlskmqxinjxxdn" },
      prod: { branch: "prod", project_ref: "viodfldzuoypnpqaagag" },
    },
  }))
  writeFileSync(join(root, "node_modules/supabase/package.json"),
    JSON.stringify({ version: "2.109.1" }))
  writeFileSync(join(root, "pnpm-lock.yaml"), [
    "lockfileVersion: '9.0'",
    "importers:",
    "  .:",
    "    devDependencies:",
    "      supabase:",
    "        specifier: 2.109.1",
    "        version: 2.109.1",
    "packages:",
    "  '@supabase/cli-linux-x64@2.109.1': {}",
    "  supabase@2.109.1:",
    "    resolution: {}",
    "snapshots:",
    "  supabase@2.109.1:",
    "    dependencies: {}",
    "",
  ].join("\n"))
  writeFileSync(join(root, "supabase/.temp/project-ref"), "xtbraqnlskmqxinjxxdn\n")
}
