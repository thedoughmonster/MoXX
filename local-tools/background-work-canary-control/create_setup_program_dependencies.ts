import { assertSetupReceiptAvailable } from "./assert_setup_receipt_available.ts"
import { collectRuntimeEvidence } from "./collect_runtime_evidence.ts"
import { prepareReceiptRoot } from "./prepare_receipt_root.ts"
import { resolveRuntimeExecutables } from "./resolve_runtime_executables.ts"
import { runBoundedChild } from "./run_bounded_child.ts"
import { runPinnedSupabaseLink } from "./run_pinned_supabase_link.ts"
import { selfTestFlockCapability } from "./self_test_flock_capability.ts"
import type { SetupProgramDependencies } from "./setup_program_types.ts"
import { validateCanonicalLinkage } from "./validate_canonical_linkage.ts"
import { writeSetupReceipt } from "./write_setup_receipt.ts"
import { writeSetupFailureReceipt } from "./write_setup_failure_receipt.ts"

export function createSetupProgramDependencies(): SetupProgramDependencies {
  const environment = process.env
  const nodeVersion = process.versions.node
  return {
    environment,
    nodeVersion,
    nowMs: () => Date.now(),
    prepareReceiptRoot,
    assertReceiptAvailable: assertSetupReceiptAvailable,
    resolveExecutables: resolveRuntimeExecutables,
    collectRepository: (root, executables) => collectRuntimeEvidence(
      root, executables, runBoundedChild, nodeVersion, environment, false,
    ),
    testFlock: selfTestFlockCapability,
    linkProject: runPinnedSupabaseLink,
    validateLinkage: validateCanonicalLinkage,
    writeReceipt: writeSetupReceipt,
    writeFailure: writeSetupFailureReceipt,
  }
}
