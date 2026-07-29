export function isAcceptableProbeStatus(
  status: number,
  configuredStatuses?: number[],
): boolean {
  if (configuredStatuses) return configuredStatuses.includes(status)
  return (status >= 200 && status < 300) ||
    status === 401 || status === 403
}
