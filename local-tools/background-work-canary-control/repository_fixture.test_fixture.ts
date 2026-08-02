import { linkSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export function createRepositoryFixture(root: string, nativeSourcePath?: string): void {
  mkdirSync(join(root, "node_modules/supabase/dist"), { recursive: true })
  mkdirSync(join(root, "node_modules/@supabase/cli-linux-x64/bin"), { recursive: true })
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
    JSON.stringify({
      name: "supabase", version: "2.109.1",
      bin: { supabase: "dist/supabase.js" },
      optionalDependencies: { "@supabase/cli-linux-x64": "2.109.1" },
    }))
  writeFileSync(join(root, "node_modules/supabase/dist/supabase.js"),
    "#!/usr/bin/env node\n", { mode: 0o500 })
  writeFileSync(join(root, "node_modules/@supabase/cli-linux-x64/package.json"),
    JSON.stringify({
      name: "@supabase/cli-linux-x64", version: "2.109.1",
      os: ["linux"], cpu: ["x64"], libc: ["glibc"], files: ["bin/"],
      publishConfig: {
        executableFiles: ["bin/supabase", "bin/supabase-go"],
      },
    }))
  const nativePath = join(root, "node_modules/@supabase/cli-linux-x64/bin/supabase")
  if (nativeSourcePath) linkSync(nativeSourcePath, nativePath)
  else writeFileSync(nativePath, "pinned native fixture\n", { mode: 0o500 })
  writeFileSync(join(root, "pnpm-lock.yaml"), [
    "lockfileVersion: '9.0'",
    "importers:",
    "  .:",
    "    devDependencies:",
    "      supabase:",
    "        specifier: 2.109.1",
    "        version: 2.109.1",
    "packages:",
    "  '@supabase/cli-linux-x64@2.109.1':",
    "    resolution: {integrity: sha512-svFmamF/vIq4/oinwY50jDi869itC9/GWrPaGtsHFkK4NUBcQtl1T37WWIivGsXwbBKNC4FjZD3dGqjL7bfW1g==}",
    "  supabase@2.109.1:",
    "    resolution: {}",
    "snapshots:",
    "  '@supabase/cli-linux-x64@2.109.1':",
    "    optional: true",
    "  supabase@2.109.1:",
    "    optionalDependencies:",
    "      '@supabase/cli-linux-x64': 2.109.1",
    "",
  ].join("\n"))
  writeFileSync(join(root, "supabase/.temp/project-ref"), "xtbraqnlskmqxinjxxdn\n")
}
