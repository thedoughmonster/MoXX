export function cancelProcessGroup(
  processId: number | undefined,
  signal: NodeJS.Signals,
): void {
  if (!processId) return
  try {
    process.kill(-processId, signal)
  } catch {
    try {
      process.kill(processId, signal)
    } catch {
      // The process already exited.
    }
  }
}
