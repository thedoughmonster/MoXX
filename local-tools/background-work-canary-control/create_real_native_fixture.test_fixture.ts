import { copyFileSync, linkSync, unlinkSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createRepositoryFixture } from "./repository_fixture.test_fixture.ts"
import { resolvePinnedNativeCli } from "./resolve_pinned_native_cli.ts"

export function createRealNativeFixture(
  root: string,
  independent = false,
): string {
  const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "../..")
  const source = resolvePinnedNativeCli(sourceRoot).sourcePath
  createRepositoryFixture(root)
  const destination = join(root, "node_modules/@supabase/cli-linux-x64/bin/supabase")
  unlinkSync(destination)
  if (independent) copyFileSync(source, destination)
  else linkSync(source, destination)
  return destination
}
