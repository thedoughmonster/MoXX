export function parseRecoveryMembershipProof(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) =>
    typeof entry !== "string" || !/^[a-f0-9]{64}$/.test(entry))) {
    throw new Error("Recovery membership proof is invalid")
  }
  if (new Set(value).size !== value.length ||
    value.some((entry, index) => index > 0 && entry <= value[index - 1])) {
    throw new Error("Recovery membership proof is not canonical")
  }
  return value
}
