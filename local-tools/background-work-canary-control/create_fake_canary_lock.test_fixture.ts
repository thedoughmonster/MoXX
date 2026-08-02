import type { CanaryControlLock } from "./process_types.ts"

export function createFakeCanaryLock(
  onRelease: () => void,
): { lock: CanaryControlLock; lose: () => void } {
  const loss = new AbortController()
  let status: "held" | "lost" | "released" | "releasing" = "held"
  const lose = () => {
    if (status !== "held") return
    status = "lost"
    loss.abort(new Error("injected holder loss"))
  }
  const release = async () => {
    if (status === "lost") throw new Error("injected holder loss")
    if (status === "released") return
    status = "releasing"
    onRelease()
    status = "released"
  }
  return {
    lose,
    lock: {
      flockPath: "/trusted/flock", lockPath: "/trusted/lock", holderPid: 999_999,
      lossSignal: loss.signal, status: () => status, release,
    },
  }
}
