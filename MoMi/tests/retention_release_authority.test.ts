import assert from "node:assert/strict"
import test from "node:test"
import { assertRetentionAuthority } from "../scripts/release/retention/assert_authority.ts"

test("accepts only exact dispatched retention workflows at the approved dev SHA", () => {
  for (const environment of ["dev", "prod"] as const) {
    const runtime = {
      GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_REPOSITORY: "thedoughmonster/MoXX", GITHUB_REF: "refs/heads/dev",
      GITHUB_SHA: "a".repeat(40), MOMI_EXPECTED_SHA: "a".repeat(40),
      GITHUB_WORKFLOW_REF:
        `thedoughmonster/MoXX/.github/workflows/deploy-${environment}.yml@refs/heads/dev`,
    }
    assert.doesNotThrow(() => assertRetentionAuthority(environment, runtime))
    const invalid = [
      { GITHUB_ACTIONS: "false" }, { GITHUB_ACTIONS: "TRUE" },
      { GITHUB_EVENT_NAME: "push" }, { GITHUB_EVENT_NAME: "pull_request" },
      { GITHUB_EVENT_NAME: "workflow_call" }, { GITHUB_EVENT_NAME: "workflow_run" },
      { GITHUB_REPOSITORY: "example/MoXX" },
      { GITHUB_REPOSITORY: "thedoughmonster/MoXX-fork" },
      { GITHUB_REF: "refs/heads/prod" }, { GITHUB_REF: "refs/tags/dev" },
      { GITHUB_REF: "refs/pull/1/merge" },
      { GITHUB_WORKFLOW_REF: runtime.GITHUB_WORKFLOW_REF.replace("@refs/heads/dev", "@refs/heads/prod") },
      { GITHUB_WORKFLOW_REF: runtime.GITHUB_WORKFLOW_REF.replace("thedoughmonster", "example") },
      { GITHUB_WORKFLOW_REF: runtime.GITHUB_WORKFLOW_REF.replace(`deploy-${environment}`, "validate") },
      { GITHUB_WORKFLOW_REF: runtime.GITHUB_WORKFLOW_REF.replace(`deploy-${environment}`, `deploy-${environment === "dev" ? "prod" : "dev"}`) },
      { GITHUB_SHA: "a".repeat(39), MOMI_EXPECTED_SHA: "a".repeat(39) },
      { GITHUB_SHA: "g".repeat(40), MOMI_EXPECTED_SHA: "g".repeat(40) },
      { GITHUB_SHA: "A".repeat(40), MOMI_EXPECTED_SHA: "A".repeat(40) },
      { MOMI_EXPECTED_SHA: "b".repeat(40) },
    ]
    for (const mutation of invalid) {
      assert.throws(() => assertRetentionAuthority(environment, { ...runtime, ...mutation }),
        /exact protected GitHub workflow and dev SHA/)
    }
    for (const key of Object.keys(runtime)) {
      assert.throws(() => assertRetentionAuthority(environment, { ...runtime, [key]: undefined }), key)
    }
  }
})
