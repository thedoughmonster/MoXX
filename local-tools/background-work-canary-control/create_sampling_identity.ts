import { validateRunId } from "./validate_run_id.ts"

export function createSamplingIdentity(
  randomBytes: (size: number) => Uint8Array,
): { runId: string; generationSha256: string } {
  const runEntropy = randomBytes(12)
  const generationEntropy = randomBytes(32)
  if (runEntropy.byteLength !== 12 || generationEntropy.byteLength !== 32) {
    throw new Error("Cryptographic identity source returned an invalid byte count")
  }
  const runId = `run-${Buffer.from(runEntropy).toString("hex")}`
  const generationSha256 = Buffer.from(generationEntropy).toString("hex")
  validateRunId(runId)
  if (!/^[a-f0-9]{64}$/.test(generationSha256)) {
    throw new Error("Cryptographic generation is invalid")
  }
  return { runId, generationSha256 }
}
