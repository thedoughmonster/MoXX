import assert from "node:assert/strict";
import test from "node:test";
import { getMetricsConfiguration } from "../src/get_metrics_configuration.ts";
import {
  syntheticDeployment, syntheticMetricsEnvironment, syntheticRefs, syntheticSecret,
  withMetricsRuntime,
} from "./metrics_runtime_fixture.ts";

test("uses the own default runtime key for the exact development and production deployment", async () => {
  for (const ref of syntheticRefs) {
    await withMetricsRuntime({
      SUPABASE_URL: `https://${ref}.supabase.co`,
      DENO_DEPLOYMENT_ID: `${ref}_${syntheticDeployment}`,
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: syntheticSecret, other: "ignored" }),
    }, (reads) => {
      const configuration = getMetricsConfiguration();
      assert.ok(configuration);
      assert.equal(configuration.url.href, `https://${ref}.supabase.co/customer/v1/privileged/metrics`);
      assert.equal(configuration.secret, syntheticSecret);
      assert.deepEqual([...new Set(reads)].sort(),
        ["DENO_DEPLOYMENT_ID", "SUPABASE_SECRET_KEYS", "SUPABASE_URL"]);
    });
  }
});

test("fails closed for absent, malformed, non-object, or unusable default key dictionaries", async () => {
  const invalidDictionaries = [
    undefined, "", "{", "null", "true", "17", '"string"', "[]", "{}",
    JSON.stringify({ other: syntheticSecret }),
    JSON.stringify({ ["__proto__"]: { default: syntheticSecret } }),
    ...[null, false, 0, {}, [], "", "legacy-token", "sb_secret_", "sb_secret_bad key",
      "sb_secret_bad:key", "sb_secret_bad\nkey"].map((value) => JSON.stringify({ default: value })),
  ];
  for (const SUPABASE_SECRET_KEYS of invalidDictionaries) {
    await withMetricsRuntime({ ...syntheticMetricsEnvironment, SUPABASE_SECRET_KEYS }, () => {
      assert.equal(getMetricsConfiguration(), null);
    });
  }
});

test("rejects another project, noncanonical origins, and malformed deployment identities", async () => {
  for (const SUPABASE_URL of [undefined, "", "not a URL",
    `https://${syntheticRefs[1]}.supabase.co`, `http://${syntheticRefs[0]}.supabase.co`,
    "https://other-project.supabase.co", "https://metrics.example.test",
    `${syntheticMetricsEnvironment.SUPABASE_URL}.example.test`,
    `${syntheticMetricsEnvironment.SUPABASE_URL}/unexpected`,
    `${syntheticMetricsEnvironment.SUPABASE_URL}?redirect=elsewhere`,
    `${syntheticMetricsEnvironment.SUPABASE_URL}#fragment`,
    `https://user:password@${syntheticRefs[0]}.supabase.co`,
  ]) {
    await withMetricsRuntime({ ...syntheticMetricsEnvironment, SUPABASE_URL }, () => {
      assert.equal(getMetricsConfiguration(), null);
    });
  }
  for (const DENO_DEPLOYMENT_ID of [undefined, "", syntheticRefs[0],
    `${syntheticRefs[1]}_${syntheticDeployment}`, `unknown_${syntheticDeployment}`,
    `${syntheticRefs[0]}_not-a-uuid_7`, `${syntheticRefs[0]}_${syntheticDeployment}_extra`,
    `${syntheticRefs[0]}_11111111-1111-4111-8111-111111111111_invalid`,
  ]) {
    await withMetricsRuntime({ ...syntheticMetricsEnvironment, DENO_DEPLOYMENT_ID }, () => {
      assert.equal(getMetricsConfiguration(), null);
    });
  }
});

test("never falls back to legacy, custom, or non-default keys", async () => {
  await withMetricsRuntime({
    ...syntheticMetricsEnvironment,
    SUPABASE_SECRET_KEYS: JSON.stringify({ custom: syntheticSecret }),
    SUPABASE_SERVICE_ROLE_KEY: syntheticSecret,
    MOMI_CRON_HISTORY_METRICS_SECRET_KEY: syntheticSecret,
    SUPABASE_SECRET_KEY: syntheticSecret,
  }, (reads) => {
    assert.equal(getMetricsConfiguration(), null);
    assert.ok(reads.every((name) => ["SUPABASE_URL", "DENO_DEPLOYMENT_ID", "SUPABASE_SECRET_KEYS"].includes(name)));
  });
});
