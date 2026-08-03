export function createRecoveryGeneration(
  randomBytes: (size: number) => Uint8Array,
): string {
  const bytes = randomBytes(32)
  if (bytes.byteLength !== 32) throw new Error("Recovery entropy source returned an invalid size")
  return Buffer.from(bytes).toString("hex")
}
