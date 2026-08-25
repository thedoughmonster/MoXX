import { runCanonicalGenerator } from "../codex_hooks/run_canonical_generator.ts"
import type { GeneratorResult } from "../codex_hooks/types.ts"
import { assertBoundedFixPaths } from "./assert_bounded_fix_paths.ts"
import { changedInventoryPaths } from "./changed_inventory_paths.ts"
import { inventoryFiles } from "./inventory_files.ts"
import type { FixId, FixReceipt, FixRegistration } from "./types.ts"

export async function runRegisteredFix(
  root: string,
  fix: FixRegistration,
  runGenerator: (
    root: string,
    kind: FixId,
  ) => Promise<GeneratorResult> = runCanonicalGenerator,
): Promise<FixReceipt> {
  await assertBoundedFixPaths(root, fix)
  const before = await inventoryFiles(root)
  let failure: unknown
  try {
    await runGenerator(root, fix.id)
  } catch (error) {
    failure = error
  }
  const changedPaths = changedInventoryPaths(before, await inventoryFiles(root))
  await assertBoundedFixPaths(root, fix)
  const allowed = new Set(fix.outputs)
  const outside = changedPaths.filter((path) => !allowed.has(path))
  if (outside.length > 0) {
    throw new Error(
      `Fix ${fix.id} wrote outside declared outputs: ${outside.join(", ")}`,
      { cause: failure },
    )
  }
  if (failure !== undefined) throw failure
  return {
    changed_paths: changedPaths,
    delegated_command: `pnpm ${fix.script}`,
    fix_id: fix.id,
    validation_command: fix.validation_command,
  }
}
