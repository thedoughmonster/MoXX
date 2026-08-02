import type { BoundedChildResult, CanaryControlLock } from "./process_types.ts"

export type SetupStage =
  | "repository" | "flock" | "link" | "linkage" | "receipt" | "provider"

export type SetupErrorCategory =
  | "FlockCleanupFailed" | "FlockConflictTestFailed" | "FlockIdentityDrift"
  | "FlockProtocolMismatch" | "FlockReleaseFailed" | "FlockUnavailable"
  | "LinkageDnsFailed" | "LinkageMetadataUnsafe" | "LinkageProjectMismatch"
  | "LinkageUrlInvalid" | "ReceiptExpired" | "ReceiptMismatch"
  | "ReceiptReused" | "RepositoryEvidenceInvalid" | "SetupReceiptFailed"
  | "ProviderPreparationFailed" | "SupabaseLinkFailed"

export type LinkageEvidence = Readonly<{
  identitySha256: string
  ipv4Resolved: true
}>

export type FlockIdentity = Readonly<{
  path: string
  device: bigint
  inode: bigint
  size: bigint
}>

export type FlockCapabilityEvidence = Readonly<{
  executablePath: "/usr/bin/flock"
  identitySha256: string
  conflictRefused: true
  reacquired: true
}>

export type FlockSelfTestFixture = Readonly<{
  directory: string
  lockPath: string
  cleanup: () => Promise<void>
}>

export type FlockSelfTestDependencies = Readonly<{
  inspect: (path: string) => Promise<FlockIdentity>
  createFixture: () => Promise<FlockSelfTestFixture>
  acquire: (path: string, lockPath: string) => Promise<CanaryControlLock>
  runProbe: (path: string, lockPath: string) => Promise<BoundedChildResult>
}>

export type SetupBinding = Readonly<{
  releaseSha: string
  projectIdentitySha256: string
  linkageIdentitySha256: string
  flockCapabilitySha256: string
  queryIdentitySha256: string
  nativeCliSha256: string
  nodeVersion: string
  pnpmVersion: string
  supabaseCliVersion: string
}>

export type SetupReceiptCore = SetupBinding & Readonly<{
  schemaVersion: 1
  status: "ready"
  stage: "receipt"
  startedAtUtc: string
  expiresAtUtc: string
  durationMs: number
  providerWorkBegan: boolean
  hostedMutationPossible: false
  completedStages: readonly ["repository", "flock", "link", "linkage", "receipt"]
  receiptPath: string
}>

export type StoredSetupReceipt = SetupReceiptCore & Readonly<{
  integritySha256: string
}>

export type SetupReceipt = StoredSetupReceipt & Readonly<{
  receiptSha256: string
}>

export type SetupReceiptPaths = Readonly<{
  directory: string
  historyPath: string
  currentPath: string
}>

export type SetupFailureReceiptCore = Readonly<{
  schemaVersion: 1
  status: "blocked"
  releaseSha: string | null
  stage: SetupStage
  errorCategory: SetupErrorCategory
  childExitCode: number | null
  sqlstate: string | null
  startedAtUtc: string
  durationMs: number
  providerWorkBegan: boolean
  hostedMutationPossible: false
  receiptPath: string
}>

export type SetupFailureReceipt = SetupFailureReceiptCore & Readonly<{
  integritySha256: string
  receiptSha256: string
}>
