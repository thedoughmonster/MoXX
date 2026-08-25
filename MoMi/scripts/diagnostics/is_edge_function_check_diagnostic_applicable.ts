export function isEdgeFunctionCheckDiagnosticApplicable(
  result: { status: number | null; error?: Error },
  toolAvailable = true,
): boolean {
  return toolAvailable && result.error === undefined && result.status !== null &&
    result.status !== 0
}
