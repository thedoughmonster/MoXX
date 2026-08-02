import type { HeldProvider, HeldProviderStatus } from "./runtime_adapter_types.ts"

export function createFakeHeldProvider(options: {
  runQuery?: HeldProvider["runQuery"]
  onClose?: () => void
} = {}): HeldProvider {
  let status: HeldProviderStatus = "held"
  return Object.freeze({
    runQuery: async (request) => {
      if (status !== "held") throw new Error("Fake held provider unavailable")
      status = "active"
      try {
        if (!options.runQuery) throw new Error("Fake query was not expected")
        return await options.runQuery(request)
      } finally { status = "held" }
    },
    status: () => status,
    close: async () => {
      if (status === "active") throw new Error("Fake held provider still active")
      if (status !== "closed") options.onClose?.()
      status = "closed"
    },
  })
}
