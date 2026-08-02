import { acquireFlockSelfTestHolder } from "./acquire_flock_self_test_holder.ts"
import { createFlockSelfTestFixture } from "./create_flock_self_test_fixture.ts"
import { inspectCanonicalFlock } from "./inspect_canonical_flock.ts"
import { runFlockSelfTestProbe } from "./run_flock_self_test_probe.ts"
import type { FlockSelfTestDependencies } from "./setup_preflight_types.ts"

export function createFlockSelfTestDependencies(): FlockSelfTestDependencies {
  return {
    inspect: inspectCanonicalFlock,
    createFixture: createFlockSelfTestFixture,
    acquire: acquireFlockSelfTestHolder,
    runProbe: runFlockSelfTestProbe,
  }
}
