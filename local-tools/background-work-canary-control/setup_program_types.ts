import type { BoundedChildResult } from "./process_types.ts"
import type { RepositoryPreflight } from "./repository_preflight_types.ts"
import type { PreflightExecutables } from "./runtime_adapter_types.ts"
import type {
  FlockCapabilityEvidence,
  LinkageEvidence,
  SetupErrorCategory,
  SetupFailureReceipt,
  SetupFailureReceiptCore,
  SetupReceipt,
  SetupReceiptCore,
  SetupStage,
} from "./setup_preflight_types.ts"

export type SetupProgramDependencies = Readonly<{
  environment: NodeJS.ProcessEnv
  nodeVersion: string
  nowMs: () => number
  prepareReceiptRoot: () => Promise<string>
  assertReceiptAvailable: (root: string) => Promise<void>
  resolveExecutables: (environment: NodeJS.ProcessEnv) => Promise<PreflightExecutables>
  collectRepository: (
    root: string, executables: PreflightExecutables,
  ) => Promise<RepositoryPreflight>
  testFlock: (path: string) => Promise<FlockCapabilityEvidence>
  linkProject: (root: string) => Promise<BoundedChildResult>
  validateLinkage: (root: string) => Promise<LinkageEvidence>
  writeReceipt: (root: string, core: Omit<SetupReceiptCore, "receiptPath">) =>
    Promise<SetupReceipt>
  writeFailure: (root: string, core: Omit<SetupFailureReceiptCore, "receiptPath">) =>
    Promise<SetupFailureReceipt>
}>

export type SetupProgramResult = Readonly<{
  exitCode: 0 | 20
  stderrCode: SetupErrorCategory | null
  envelope: null | Readonly<{
    status: "setup_ready" | "setup_blocked"
    receiptPath: string
    receiptSha256: string
    stage?: SetupStage
    errorCategory?: SetupErrorCategory
  }>
}>
