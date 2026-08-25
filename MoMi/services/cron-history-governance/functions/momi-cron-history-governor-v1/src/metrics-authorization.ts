export function metricsAuthorization(secret: string): string {
  return `Basic ${btoa(`service_role:${secret}`)}`;
}
