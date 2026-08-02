import { closeSync, fstatSync, lstatSync, realpathSync, rmdirSync } from "node:fs"
import { dirname, isAbsolute, resolve } from "node:path"
import type { HeldNativeSnapshot } from "./native_cli_installation_types.ts"
import type { BoundedChildResult } from "./process_types.ts"
import { REQUIRED_SUPABASE_VERSION } from "./repository_preflight_constants.ts"
import { HELD_EXECUTABLES } from "./sealed_held_executable.ts"
import type { SealedHeldExecutable } from "./sealed_held_executable.ts"
import type { BoundedChildRunner,
  HeldProviderStatus } from "./runtime_adapter_types.ts"

export class HeldNativeProviderOwner {
  readonly #snapshot: HeldNativeSnapshot
  readonly #repositoryRoot: string
  readonly #environment: NodeJS.ProcessEnv
  readonly #runChild: BoundedChildRunner
  readonly #sealedExecutable: SealedHeldExecutable
  #descriptorOwned = true
  #directoryPresent = true
  #identityLost = false
  #state: HeldProviderStatus = "held"

  constructor(snapshot: HeldNativeSnapshot, repositoryRoot: string,
    environment: NodeJS.ProcessEnv, runChild: BoundedChildRunner) {
    this.#snapshot = snapshot
    this.#repositoryRoot = repositoryRoot
    this.#environment = environment
    this.#runChild = runChild
    this.#sealedExecutable = HELD_EXECUTABLES.seal({ fd: snapshot.fd,
      device: snapshot.device, inode: snapshot.inode, size: snapshot.size })
  }

  status(): HeldProviderStatus {
    if (this.#state !== "held") return this.#state
    try { this.#assertLive() } catch { this.#state = "lost" }
    return this.#state
  }

  async verifyVersion(): Promise<void> {
    const result = await this.#execute(["--version"])
    if (result.outcome.status !== "success" || result.outcome.exitCode !== 0 ||
      new TextDecoder("utf-8", { fatal: true }).decode(result.stdout) !==
      `${REQUIRED_SUPABASE_VERSION}\n` || result.stderr.byteLength !== 0) {
      this.#state = "lost"
      throw new Error("Held native provider version check failed")
    }
  }

  async runQuery(request: { repositoryRoot: string, sqlPath: string,
    signal?: AbortSignal }): Promise<BoundedChildResult> {
    if (request.repositoryRoot !== this.#repositoryRoot ||
      !isAbsolute(request.sqlPath) || resolve(request.sqlPath) !== request.sqlPath ||
      realpathSync(request.sqlPath) !== request.sqlPath) throw new Error("Provider query scope invalid")
    const sql = lstatSync(request.sqlPath)
    const parent = lstatSync(dirname(request.sqlPath))
    if (!sql.isFile() || sql.isSymbolicLink() || sql.nlink !== 1 ||
      (sql.mode & 0o777) !== 0o600 || !parent.isDirectory() || parent.isSymbolicLink() ||
      (parent.mode & 0o777) !== 0o700) throw new Error("Provider query file invalid")
    return await this.#execute([
      "db", "query", "--linked", "--file", request.sqlPath,
      "--workdir", this.#repositoryRoot, "--output-format", "json",
    ], request.signal)
  }

  async close(): Promise<void> {
    if (this.#state === "closed") return
    if (this.#state === "active") throw new Error("Provider is still active")
    let failed = false
    if (this.#descriptorOwned) {
      try {
        this.#assertLive()
        closeSync(this.#snapshot.fd)
      } catch {
        this.#identityLost = true
        failed = true
      }
      this.#descriptorOwned = false
    }
    if (this.#directoryPresent) {
      try { rmdirSync(this.#snapshot.directory); this.#directoryPresent = false } catch {
        failed = true
      }
    }
    if (failed || this.#identityLost || this.#directoryPresent) {
      this.#state = "lost"
      throw new Error("Held native provider cleanup failed")
    }
    this.#state = "closed"
  }

  async #execute(arguments_: readonly string[], signal?: AbortSignal) {
    if (this.#state !== "held") throw new Error("Held native provider is unavailable")
    this.#assertLive()
    this.#state = "active"
    try {
      const result = await this.#runChild({
        executable: "/proc/self/fd/3",
        heldExecutable: this.#sealedExecutable,
        arguments: arguments_, environment: this.#environment, signal,
      })
      this.#assertLive()
      this.#state = "held"
      return result
    } catch (error) {
      try { this.#assertLive(); this.#state = "held" } catch { this.#state = "lost" }
      throw error
    }
  }

  #assertLive(): void {
    const held = fstatSync(this.#snapshot.fd, { bigint: true })
    if (!held.isFile() || held.dev !== this.#snapshot.device ||
      held.ino !== this.#snapshot.inode || held.size !== BigInt(this.#snapshot.size) ||
      held.nlink !== 0n || (held.mode & 0o777n) !== 0o500n) {
      throw new Error("Held native provider descriptor was lost")
    }
  }
}
