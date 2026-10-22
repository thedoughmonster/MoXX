import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("isolates the approved retention path in protected deployment workflows", async () => {
  const ordinaryGuard = "if: ${{ inputs.retention_approval == '' }}"
  const exceptionGuard = "if: ${{ inputs.retention_approval != '' }}"
  for (const environment of ["dev", "prod"]) {
    const workflow = (await readFile(new URL(
      `../../.github/workflows/deploy-${environment}.yml`, import.meta.url,
    ), "utf8")).replaceAll("\r\n", "\n")
    assert.match(workflow, /^on:\n  workflow_dispatch:\n    inputs:/m)
    assert.doesNotMatch(workflow, /^  (push|pull_request|schedule|workflow_call|workflow_run):/m)
    const inputBlock = workflow.split("    inputs:\n")[1].split("\npermissions:")[0]
    assert.ok([...inputBlock.matchAll(/^      \w+:$/gm)].length <= 10)
    assert.match(inputBlock, /retention_approval:\n        description:[^\n]+\n        required: false\n        default: ""\n        type: string/)
    assert.match(workflow, /^permissions:\n  contents: read\n  actions: read\n\n/m)
    assert.ok(workflow.includes(`    environment: ${environment}\n`))
    assert.ok(workflow.includes(`concurrency:\n  group: deploy-backend-${environment}\n  cancel-in-progress: false`))
    assert.ok(workflow.includes("MOMI_EXPECTED_SHA: ${{ inputs.expected_sha }}"))
    assert.ok(workflow.includes('test "$MOMI_EXPECTED_SHA" = "$GITHUB_SHA"'))
    assert.ok(workflow.includes('test "$MOMI_EXPECTED_SHA" = "$(git rev-parse HEAD)"'))
    const checkoutRef = environment === "dev" ? "dev" :
      "${{ inputs.retention_approval != '' && 'dev' || 'prod' }}"
    assert.ok(workflow.includes(`          ref: ${checkoutRef}\n          fetch-depth: 0`))

    const steps = workflow.split(/(?=^      - )/m).slice(1)
    let plan = "", apply = "", ordinaryArtifact = "", preflight = "", execute = ""
    let receipt = "", evidence = ""
    for (const step of steps) {
      if (step.includes("assert_bound_deployment_plan.ts")) plan = step
      if (step.includes("pnpm run deploy:apply")) apply = step
      if (step.includes("path: MoMi/.momi/releases/*.json")) ordinaryArtifact = step
      if (step.includes("name: Verify retention exception approval")) preflight = step
      if (step.includes("name: Run approved retention exception")) execute = step
      if (step.includes("path: MoMi/.momi/retention-release-receipt.json")) receipt = step
      if (step.includes("path: MoMi/.momi/retention-release-evidence.json")) evidence = step
    }
    for (const ordinary of [plan, apply, ordinaryArtifact]) {
      assert.ok(ordinary.includes(ordinaryGuard))
      assert.ok(!ordinary.includes(exceptionGuard))
    }
    assert.ok(plan.includes('pnpm momi-impact plan --base "${{ inputs.base_sha }}"'))
    assert.ok(plan.includes('--head "$MOMI_EXPECTED_SHA"'))
    assert.ok(plan.includes('--digest "$MOMI_PLAN_SHA256"'))
    assert.ok(plan.includes('--tree "$MOMI_VALIDATED_TREE"'))
    assert.ok(ordinaryArtifact.includes(`name: ${environment}-release-\${{ github.sha }}`))
    if (environment === "dev") {
      assert.ok(apply.includes("args=(--env dev)"))
      assert.ok(apply.includes('pnpm run deploy:apply -- "${args[@]}"'))
      assert.ok(apply.includes("MOMI_RETIRE_FUNCTIONS: ${{ inputs.retire_functions }}"))
    } else {
      assert.ok(apply.includes('pnpm run deploy:apply -- --env prod --services "${{ inputs.services }}"'))
    }
    for (const step of [preflight, execute]) {
      assert.ok(step.includes(exceptionGuard))
      assert.ok(step.includes("MOMI_SERVICES: ${{ inputs.services }}"))
      if (environment === "dev") {
        assert.ok(step.includes("MOMI_RETIRE_FUNCTIONS: ${{ inputs.retire_functions }}"))
      }
      assert.ok(step.includes("MOMI_RETENTION_APPROVAL_JSON: ${{ inputs.retention_approval }}"))
      assert.ok(step.includes("MOMI_RETENTION_APPROVAL_SHA256: ${{ vars.MOMI_RETENTION_APPROVAL_SHA256 }}"))
      assert.ok(step.includes("GH_TOKEN: ${{ github.token }}"))
      const run = step.split("        run: ")[1]
      assert.ok(run)
      assert.doesNotMatch(run, /\$\{\{|TOKEN|APPROVAL|--token/)
    }
    assert.equal(preflight.split("        run: ")[1],
      `node scripts/run_retention_release.ts --env ${environment} --verify-only\n`)
    assert.doesNotMatch(preflight, /SUPABASE_ACCESS_TOKEN|secrets\./)
    assert.equal(execute.split("        run: ")[1],
      `node scripts/run_retention_release.ts --env ${environment}\n`)
    assert.ok(execute.includes("SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}"))
    assert.ok(workflow.indexOf('test "$MOMI_EXPECTED_SHA"') < workflow.indexOf(preflight))
    assert.ok(workflow.indexOf(preflight) < workflow.indexOf(execute))
    assert.ok(receipt.includes("if: ${{ success() && inputs.retention_approval != '' }}"))
    assert.ok(receipt.includes(`name: retention-${environment}-\${{ github.sha }}-\${{ github.run_id }}`))
    assert.ok(receipt.includes("if-no-files-found: error"))
    assert.ok(evidence.includes("if: ${{ always() && inputs.retention_approval != '' && !success() }}"))
    assert.ok(evidence.includes(`name: retention-${environment}-evidence-\${{ github.sha }}-\${{ github.run_id }}`))
    assert.ok(evidence.includes("if-no-files-found: ignore"))
    assert.ok(workflow.indexOf(execute) < workflow.indexOf(receipt))
    assert.ok(workflow.indexOf(receipt) < workflow.indexOf(evidence))
  }
})
