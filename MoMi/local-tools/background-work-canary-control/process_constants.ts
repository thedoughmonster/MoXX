export const CHILD_HARD_TIMEOUT_MS = 10_000
export const CHILD_OUTPUT_LIMIT_BYTES = 64 * 1024
export const CHILD_MAX_OUTPUT_LIMIT_BYTES = 2 * 1024 * 1024
export const CHILD_TERMINATION_GRACE_MS = 250

export const CANARY_LOCK_FILENAME = "momi-330-canary-control.lock"
export const FLOCK_CONFLICT_EXIT_CODE = 73
export const LOCK_ACQUIRE_TIMEOUT_MS = 2_000
export const LOCK_READY_MARKER = "LOCKED\n"
export const LOCK_RELEASED_MARKER = "RELEASED\n"
export const LOCK_PROTOCOL_MAX_BYTES =
  Buffer.byteLength(LOCK_READY_MARKER + LOCK_RELEASED_MARKER, "utf8")

export const FLOCK_ARGUMENTS_PREFIX = [
  "--nonblock",
  "--no-fork",
  "--conflict-exit-code",
  String(FLOCK_CONFLICT_EXIT_CODE),
  "--",
] as const

export const LOCK_HOLDER_SCRIPT = [
  `process.stdout.write(${JSON.stringify(LOCK_READY_MARKER)}, () => {`,
  "process.stdin.resume();",
  "process.stdin.once('end', () => {",
  `process.stdout.write(${JSON.stringify(LOCK_RELEASED_MARKER)},`,
  "() => process.exit(0));",
  "});",
  "});",
].join("")
