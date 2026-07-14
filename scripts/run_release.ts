import { acquireReleaseLock } from "./release/acquire_release_lock.ts"
import { parseReleaseEnvironment } from "./release/parse_release_environment.ts"
import { releaseDev } from "./release/release_dev.ts"
import { releaseProd } from "./release/release_prod.ts"
import { releaseReleaseLock } from "./release/release_release_lock.ts"

const environment = parseReleaseEnvironment()
acquireReleaseLock(environment)
try {
  if (environment === "dev") await releaseDev()
  else await releaseProd()
} finally {
  releaseReleaseLock()
}
