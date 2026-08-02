import { canonicalJson } from "./canonical_json.ts"
import { FLOCK_CONFLICT_EXIT_CODE } from "./process_constants.ts"
import { CANONICAL_FLOCK_PATH } from "./setup_preflight_constants.ts"
import { createFlockSelfTestDependencies } from "./create_flock_self_test_dependencies.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"
import type {
  FlockCapabilityEvidence,
  FlockSelfTestDependencies,
} from "./setup_preflight_types.ts"
import { sha256Text } from "./sha256_text.ts"

export async function selfTestFlockCapability(
  flockPath: string,
  dependencies: FlockSelfTestDependencies = createFlockSelfTestDependencies(),
): Promise<FlockCapabilityEvidence> {
  if (flockPath !== CANONICAL_FLOCK_PATH) {
    throw new SetupPreflightError("FlockUnavailable", "flock")
  }
  const before = await dependencies.inspect(flockPath)
  let fixture
  let holder
  let evidence: FlockCapabilityEvidence | undefined
  let failure: unknown
  try {
    fixture = await dependencies.createFixture()
    try { holder = await dependencies.acquire(flockPath, fixture.lockPath) } catch {
      throw new SetupPreflightError("FlockProtocolMismatch", "flock")
    }
    const during = await dependencies.inspect(flockPath)
    if (during.device !== before.device || during.inode !== before.inode ||
      during.size !== before.size) {
      throw new SetupPreflightError("FlockIdentityDrift", "flock")
    }
    const conflict = await dependencies.runProbe(flockPath, fixture.lockPath)
    if (conflict.outcome.status !== "exit_failure" ||
      conflict.outcome.exitCode !== FLOCK_CONFLICT_EXIT_CODE ||
      conflict.outcome.signal !== null || conflict.stdout.byteLength !== 0 ||
      conflict.stderr.byteLength !== 0) {
      throw new SetupPreflightError("FlockConflictTestFailed", "flock")
    }
    try { await holder.release(); holder = undefined } catch {
      throw new SetupPreflightError("FlockReleaseFailed", "flock")
    }
    const reacquired = await dependencies.runProbe(flockPath, fixture.lockPath)
    if (reacquired.outcome.status !== "success" || reacquired.outcome.exitCode !== 0 ||
      reacquired.outcome.signal !== null || reacquired.stdout.byteLength !== 0 ||
      reacquired.stderr.byteLength !== 0) {
      throw new SetupPreflightError("FlockProtocolMismatch", "flock")
    }
    const after = await dependencies.inspect(flockPath)
    if (after.device !== before.device || after.inode !== before.inode ||
      after.size !== before.size) {
      throw new SetupPreflightError("FlockIdentityDrift", "flock")
    }
    evidence = {
      executablePath: CANONICAL_FLOCK_PATH,
      identitySha256: sha256Text(canonicalJson({
        path: before.path, device: before.device.toString(),
        inode: before.inode.toString(), size: before.size.toString(),
      })),
      conflictRefused: true,
      reacquired: true,
    }
  } catch (error) { failure = error }
  if (holder) try { await holder.release() } catch {
    failure = new SetupPreflightError("FlockReleaseFailed", "flock")
  }
  if (fixture) try { await fixture.cleanup() } catch {
    failure = new SetupPreflightError("FlockCleanupFailed", "flock")
  }
  if (failure) {
    if (failure instanceof SetupPreflightError) throw failure
    throw new SetupPreflightError("FlockProtocolMismatch", "flock")
  }
  if (!evidence) throw new SetupPreflightError("FlockProtocolMismatch", "flock")
  return evidence
}
