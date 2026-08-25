import type { InstalledSignalHandlers,
  SignalSource } from "./program_types.ts"

export function installBoundedSignalHandlers(
  source: SignalSource,
): InstalledSignalHandlers {
  const controller = new AbortController()
  let count = 0
  let removed = false
  const handle = () => {
    count += 1
    controller.abort()
  }
  source.on("SIGINT", handle)
  source.on("SIGTERM", handle)
  return {
    signal: controller.signal,
    signalCount: () => count,
    remove: () => {
      if (removed) return
      removed = true
      source.off("SIGINT", handle)
      source.off("SIGTERM", handle)
    },
  }
}
