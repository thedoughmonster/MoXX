export const syntheticSecret = `sb_secret_${"synthetic_test_key_".repeat(3)}`;
export const syntheticRefs = ["xtbraqnlskmqxinjxxdn", "viodfldzuoypnpqaagag"];
export const syntheticDeployment = "11111111-1111-4111-8111-111111111111_7";
export const syntheticMetricsEnvironment = {
  SUPABASE_URL: `https://${syntheticRefs[0]}.supabase.co`,
  DENO_DEPLOYMENT_ID: `${syntheticRefs[0]}_${syntheticDeployment}`,
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: syntheticSecret }),
};

// Never consult process.env or the installed Deno environment; restore only its descriptor.
export async function withMetricsRuntime(
  values: Record<string, string | undefined>,
  check: (reads: string[]) => void | Promise<void>,
): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(globalThis, "Deno");
  const reads: string[] = [];
  Object.defineProperty(globalThis, "Deno", { configurable: true, value: {
    env: { get: (key: string) => {
      reads.push(key);
      return Object.hasOwn(values, key) ? values[key] : undefined;
    } },
  } });
  try {
    await check(reads);
  } finally {
    if (original) Object.defineProperty(globalThis, "Deno", original);
    else Reflect.deleteProperty(globalThis, "Deno");
  }
}
