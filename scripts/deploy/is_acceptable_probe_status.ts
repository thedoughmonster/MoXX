export function isAcceptableProbeStatus(
  status: number,
): boolean {
  return (status >= 200 && status < 300) ||
    status === 401 || status === 403
}
