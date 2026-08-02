import { spawn } from "node:child_process"

import { buildSafeChildEnvironment } from "./build_safe_child_environment.ts"
import { cancelProcessGroup } from "./cancel_process_group.ts"
import {
  CHILD_HARD_TIMEOUT_MS,
  CHILD_OUTPUT_LIMIT_BYTES,
  CHILD_TERMINATION_GRACE_MS,
} from "./process_constants.ts"
import type {
  BoundedChildRequest,
  BoundedChildResult,
  BoundedChildStatus,
} from "./process_types.ts"
import { resolveSafeExecutable } from "./resolve_safe_executable.ts"
import { HELD_EXECUTABLES } from "./sealed_held_executable.ts"

let childInFlight = false

export async function runBoundedChild(
  request: BoundedChildRequest,
): Promise<BoundedChildResult> {
  const timeoutMs = request.timeoutMs ?? CHILD_HARD_TIMEOUT_MS
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new Error("Bounded child timeout is invalid")
  }
  if (!Array.isArray(request.arguments) || request.arguments.length > 256 ||
    request.arguments.some((argument) =>
      typeof argument !== "string" || argument.includes("\0") || argument.length > 8192
    )) throw new Error("Bounded child arguments are invalid")
  if (childInFlight) throw new Error("Bounded child executor is already active")
  if (request.signal?.aborted) {
    return { outcome: { status: "cancelled", exitCode: null, signal: null,
      stdoutBytes: 0, stderrBytes: 0, limitedStream: null },
    stdout: new Uint8Array(), stderr: new Uint8Array() }
  }
  childInFlight = true
  let executable: string
  let stdio: ["ignore", "pipe", "pipe"] | ["ignore", "pipe", "pipe", number]
  try {
    if (request.heldExecutable === undefined) {
      if (request.executable === "/proc/self/fd/3") throw new Error()
      executable = await resolveSafeExecutable(request.executable)
      stdio = ["ignore", "pipe", "pipe"]
    } else {
      if (request.executable !== "/proc/self/fd/3") throw new Error()
      const held = HELD_EXECUTABLES.inspect(request.heldExecutable)
      executable = request.executable
      stdio = ["ignore", "pipe", "pipe", held.fd]
    }
  } catch (error) {
    childInFlight = false
    throw error
  }
  if (request.signal?.aborted) {
    childInFlight = false
    return { outcome: { status: "cancelled", exitCode: null, signal: null,
      stdoutBytes: 0, stderrBytes: 0, limitedStream: null },
    stdout: new Uint8Array(), stderr: new Uint8Array() }
  }
  let child
  try {
    child = spawn(executable, [...request.arguments], {
      detached: true,
      env: buildSafeChildEnvironment(request.environment),
      shell: false,
      stdio,
      windowsHide: true,
    })
  } catch {
    childInFlight = false
    throw new Error("Bounded child failed to start")
  }
  return await new Promise<BoundedChildResult>((resolve, reject) => {
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let stdoutBytes = 0
    let stderrBytes = 0
    let status: BoundedChildStatus | undefined
    let limitedStream: "stderr" | "stdout" | null = null
    let killTimer: NodeJS.Timeout | undefined
    const stop = (reason: BoundedChildStatus) => {
      if (status) return
      status = reason
      cancelProcessGroup(child.pid, "SIGTERM")
      killTimer = setTimeout(
        () => cancelProcessGroup(child.pid, "SIGKILL"),
        CHILD_TERMINATION_GRACE_MS,
      )
    }
    const capture = (target: Buffer[], chunk: Buffer, stream: "stderr" | "stdout") => {
      if (stream === "stdout") stdoutBytes += chunk.length
      else stderrBytes += chunk.length
      const prior = stream === "stdout" ? stdoutBytes - chunk.length : stderrBytes - chunk.length
      const remaining = Math.max(0, CHILD_OUTPUT_LIMIT_BYTES - prior)
      if (remaining > 0) target.push(chunk.subarray(0, remaining))
      if (chunk.length > remaining && !limitedStream) {
        limitedStream = stream
        stop("output_limit")
      }
    }
    const timeout = setTimeout(() => stop("timed_out"), timeoutMs)
    const abort = () => stop("cancelled")
    request.signal?.addEventListener("abort", abort, { once: true })
    if (request.signal?.aborted) abort()
    child.stdout.on("data", (chunk: Buffer) => capture(stdout, chunk, "stdout"))
    child.stderr.on("data", (chunk: Buffer) => capture(stderr, chunk, "stderr"))
    child.once("error", () => {
      clearTimeout(timeout)
      if (killTimer) clearTimeout(killTimer)
      request.signal?.removeEventListener("abort", abort)
      childInFlight = false
      reject(new Error("Bounded child failed to start"))
    })
    child.once("close", (code, signal) => {
      clearTimeout(timeout)
      if (killTimer) clearTimeout(killTimer)
      request.signal?.removeEventListener("abort", abort)
      childInFlight = false
      const finalStatus = status ?? (signal ? "signalled" : code === 0 ? "success" : "exit_failure")
      resolve({ outcome: { status: finalStatus, exitCode: code, signal,
        stdoutBytes, stderrBytes, limitedStream },
      stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) })
    })
  })
}
