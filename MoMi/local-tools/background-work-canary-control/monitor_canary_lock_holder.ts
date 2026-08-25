import type { ChildProcess } from "node:child_process"

import { CHILD_TERMINATION_GRACE_MS,
  FLOCK_CONFLICT_EXIT_CODE, LOCK_ACQUIRE_TIMEOUT_MS,
  LOCK_PROTOCOL_MAX_BYTES, LOCK_READY_MARKER,
  LOCK_RELEASED_MARKER } from "./process_constants.ts"
import type { CanaryControlLock } from "./process_types.ts"

export async function monitorCanaryLockHolder(
  child: ChildProcess,
  flockPath: string,
  lockPath: string,
  releaseTimeoutMs = CHILD_TERMINATION_GRACE_MS,
): Promise<CanaryControlLock> {
  if (!child.stdin || !child.stdout || child.pid === undefined ||
    !Number.isInteger(releaseTimeoutMs) || releaseTimeoutMs < 1) {
    throw new Error("Canary control lock holder is invalid")
  }
  const readyBytes = Buffer.from(LOCK_READY_MARKER)
  const completeBytes = Buffer.from(LOCK_READY_MARKER + LOCK_RELEASED_MARKER)
  let output = Buffer.alloc(0)
  let closed = false
  let ready = false
  let releaseAcknowledged = false
  let protocolInvalid = false
  let status: "held" | "lost" | "released" | "releasing" = "held"
  const loss = new AbortController()
  let settleAcquisition!: () => void
  let rejectAcquisition!: (error: Error) => void
  let settleRelease: (() => void) | undefined
  let rejectRelease: ((error: Error) => void) | undefined
  let releaseTimer: NodeJS.Timeout | undefined
  const acquisition = new Promise<void>((resolve, reject) => {
    settleAcquisition = resolve
    rejectAcquisition = reject
  })
  const markLost = (message: string) => {
    if (status === "lost" || status === "released") return
    status = "lost"
    const error = new Error(message)
    loss.abort(error)
    rejectRelease?.(error)
  }
  const rejectProtocol = () => {
    protocolInvalid = true
    if (ready) markLost("Canary control lock holder protocol failed")
    else rejectAcquisition(new Error("Canary control lock holder returned an invalid marker"))
    child.kill("SIGKILL")
  }
  child.stdout.on("data", (chunk: Buffer) => {
    if (protocolInvalid) return
    if (output.byteLength + chunk.byteLength > LOCK_PROTOCOL_MAX_BYTES) {
      rejectProtocol()
      return
    }
    output = Buffer.concat([output, chunk], output.byteLength + chunk.byteLength)
    if (!completeBytes.subarray(0, output.byteLength).equals(output)) {
      rejectProtocol()
      return
    }
    if (!ready) {
      if (output.equals(readyBytes)) {
        ready = true
        settleAcquisition()
      } else if (output.byteLength > readyBytes.byteLength) rejectProtocol()
      return
    }
    if (status !== "releasing") {
      rejectProtocol()
      return
    }
    if (output.equals(completeBytes)) releaseAcknowledged = true
  })
  child.once("error", () => {
    if (ready) markLost("Canary control lock holder process failed")
    else rejectAcquisition(new Error("Canary control lock holder failed to start"))
  })
  child.stdin.once("error", () => {
    if (ready) markLost("Canary control lock holder input failed")
    else rejectAcquisition(new Error("Canary control lock holder failed to start"))
  })
  child.once("close", (code, signal) => {
    closed = true
    if (releaseTimer) clearTimeout(releaseTimer)
    if (!ready) {
      if (code === FLOCK_CONFLICT_EXIT_CODE && output.byteLength === 0) {
        rejectAcquisition(new Error("Canary control lock is already held"))
      } else {
        rejectAcquisition(new Error("Canary control lock acquisition failed"))
      }
      return
    }
    if (status === "releasing" && releaseAcknowledged && !protocolInvalid &&
      output.equals(completeBytes) && code === 0 && signal === null) {
      status = "released"
      settleRelease?.()
    } else {
      markLost("Canary control lock holder exited unexpectedly")
    }
  })
  const acquisitionTimer = setTimeout(() => {
    rejectAcquisition(new Error("Canary control lock acquisition timed out"))
    child.kill("SIGKILL")
  }, LOCK_ACQUIRE_TIMEOUT_MS)
  try {
    await acquisition
  } finally {
    clearTimeout(acquisitionTimer)
  }
  let releasePromise: Promise<void> | undefined
  const release = (): Promise<void> => {
    if (status === "lost") return Promise.reject(new Error("Lock holder was already lost"))
    if (status === "released") return Promise.resolve()
    if (releasePromise) return releasePromise
    if (closed || status !== "held") return Promise.reject(new Error("Lock cannot release"))
    status = "releasing"
    releasePromise = new Promise<void>((resolve, reject) => {
      settleRelease = resolve
      rejectRelease = reject
      releaseTimer = setTimeout(() => {
        markLost("Canary control lock release timed out")
        child.kill("SIGKILL")
      }, releaseTimeoutMs)
      child.stdin!.end()
    })
    return releasePromise
  }
  return {
    flockPath, lockPath, holderPid: child.pid, lossSignal: loss.signal,
    status: () => status, release,
    retainUntilExit: () => {
      child.unref()
      child.stdin!.unref()
      child.stdout!.unref()
    },
  }
}
