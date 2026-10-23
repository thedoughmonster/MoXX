export function getMetricsConfiguration(): { url: URL; secret: string } | null {
  try {
    const projectUrl = Deno.env.get("SUPABASE_URL");
    const deployment = Deno.env.get("DENO_DEPLOYMENT_ID");
    if (!projectUrl || !deployment) return null;
    const identity = /^([a-z]{20})_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9]+$/.exec(deployment);
    if (!identity || !["xtbraqnlskmqxinjxxdn", "viodfldzuoypnpqaagag"].includes(identity[1])) {
      return null;
    }
    const origin = `https://${identity[1]}.supabase.co`;
    if (projectUrl !== origin && projectUrl !== `${origin}/`) return null;
    const encoded = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!encoded) return null;
    const keys: unknown = JSON.parse(encoded);
    if (!keys || typeof keys !== "object" || Array.isArray(keys) ||
      !Object.hasOwn(keys, "default")) return null;
    const secret = (keys as Record<string, unknown>).default;
    if (typeof secret !== "string" || !/^sb_secret_[A-Za-z0-9_-]+$/.test(secret)) return null;
    return { url: new URL("/customer/v1/privileged/metrics", origin), secret };
  } catch {
    return null;
  }
}
