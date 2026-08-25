export function createNextGeneration(
  randomBytes: (size: number) => Uint8Array,
  currentGenerationSha256: string,
): string {
  const entropy = randomBytes(32)
  const next = Buffer.from(entropy).toString("hex")
  if (entropy.byteLength !== 32 || !/^[a-f0-9]{64}$/.test(next) ||
    next === currentGenerationSha256) {
    throw new Error("Next cryptographic generation is invalid")
  }
  return next
}
