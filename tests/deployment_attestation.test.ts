import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import type { LoadedFunction } from "../scripts/architecture/types.ts"
import { buildFunctionAttestations } from
  "../scripts/deploy/build_function_attestations.ts"
import { isAcceptableProbeStatus } from
  "../scripts/deploy/is_acceptable_probe_status.ts"
import { parseFunctionVerifyJwt } from
  "../scripts/deploy/parse_function_verify_jwt.ts"
import { parseHostedFunctions } from "../scripts/deploy/parse_hosted_functions.ts"
import type { HostedFunction } from "../scripts/deploy/types.ts"

test("preserves and sorts hosted function metadata", () => {
  const output = JSON.stringify([{
    slug: "zeta-v1",
    status: "ACTIVE",
    version: 7,
    verify_jwt: false,
    entrypoint_path: "supabase/functions/zeta-v1/index.ts",
    ezbr_sha256: "b".repeat(64),
  }, {
    slug: "alpha-v1",
    status: "THROTTLED",
    version: 3,
    verify_jwt: true,
    entrypoint_path: "supabase/functions/alpha-v1/index.ts",
    ezbr_sha256: "a".repeat(64),
  }])
  assert.deepEqual(parseHostedFunctions(output), [{
    slug: "alpha-v1",
    status: "THROTTLED",
    version: 3,
    verify_jwt: true,
    entrypoint_path: "supabase/functions/alpha-v1/index.ts",
    ezbr_sha256: "a".repeat(64),
  }, {
    slug: "zeta-v1",
    status: "ACTIVE",
    version: 7,
    verify_jwt: false,
    entrypoint_path: "supabase/functions/zeta-v1/index.ts",
    ezbr_sha256: "b".repeat(64),
  }])
})

test("reads verify_jwt settings only from function sections", () => {
  const settings = parseFunctionVerifyJwt(`
verify_jwt = false
[functions.alpha-v1]
verify_jwt = false
[api]
verify_jwt = true
[functions.beta-v1]
verify_jwt = true # explicit
`)
  assert.deepEqual([...settings], [["alpha-v1", false], ["beta-v1", true]])
})

test("accepts an authorization challenge only for JWT-protected probes", () => {
  assert.equal(isAcceptableProbeStatus(200, false), true)
  assert.equal(isAcceptableProbeStatus(401, true), true)
  assert.equal(isAcceptableProbeStatus(403, true), true)
  assert.equal(isAcceptableProbeStatus(401, false), false)
  assert.equal(isAcceptableProbeStatus(404, true), false)
  assert.equal(isAcceptableProbeStatus(500, true), false)
})

test("pairs hosted bundle metadata with a deterministic function manifest digest", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "momi-attestation-"))
  t.after(async () => await rm(directory, { recursive: true, force: true }))
  await writeFile(join(directory, "function.json"), '{"function_key":"demo"}\n')
  const hosted: HostedFunction = {
    slug: "demo-v1",
    status: "ACTIVE",
    version: 4,
    verify_jwt: false,
    entrypoint_path: "supabase/functions/demo-v1/index.ts",
    ezbr_sha256: "c".repeat(64),
  }
  const functions = [{
    slug: "demo-v1",
    manifest_directory: directory,
  }] as LoadedFunction[]
  assert.deepEqual(await buildFunctionAttestations(functions, [hosted]), [{
    ...hosted,
    function_json_sha256:
      "878857e0dedea2c579d69ec8640efb9254ba6161eb991e052b34063d9b46f163",
  }])
})
