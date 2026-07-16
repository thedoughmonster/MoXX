export function isAcceptableProbeStatus(
  status: number,
  verifyJwt: boolean,
): boolean {
  return (status >= 200 && status < 300) ||
    (verifyJwt && (status === 401 || status === 403))
}
