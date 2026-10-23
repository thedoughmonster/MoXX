import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  assertRoutingPolicy,
  classifyPaths,
  hasExplicitInterfaceStatement,
} from "../scripts/monorepo-routing.mjs"

test("MoMi-only changes select only backend validation", () => {
  assert.deepEqual(classifyPaths(["MoMi/services/orders/index.ts"]), {
    paths: ["MoMi/services/orders/index.ts"],
    momi: true,
    moxi: false,
    root: false,
    cross: false,
  })
})

test("MoXi-only changes select only UI validation", () => {
  assert.deepEqual(classifyPaths(["MoXi/src/App.tsx"]), {
    paths: ["MoXi/src/App.tsx"],
    momi: false,
    moxi: true,
    root: false,
    cross: false,
  })
})

test("product validation workflow changes retain their product selection", () => {
  assert.deepEqual(
    classifyPaths([".github/workflows/validate.yml"]),
    {
      paths: [".github/workflows/validate.yml"],
      momi: true,
      moxi: false,
      root: false,
      cross: false,
    },
  )
  assert.deepEqual(
    classifyPaths([".github/workflows/validate-ui.yml"]),
    {
      paths: [".github/workflows/validate-ui.yml"],
      momi: false,
      moxi: true,
      root: false,
      cross: false,
    },
  )
})

test("cross-product PRs select both and require meaningful interface evidence", () => {
  const paths = ["MoMi/services/preorder/index.ts", "MoXi/src/api/preorder.ts"]
  for (const body of ["", "Interface impact: none", "Interface impact: N/A"]) {
    assert.throws(() => assertRoutingPolicy(paths, body, "pull_request"), /Interface impact/)
  }
  assert.deepEqual(
    assertRoutingPolicy(paths, "Interface impact: preorder-v1 remains compatible", "pull_request"),
    { paths, momi: true, moxi: true, root: false, cross: true },
  )
})

test("cross-product pushes select both products without PR evidence", () => {
  const paths = ["MoMi/services/preorder/index.ts", "MoXi/src/api/preorder.ts"]
  for (const body of [undefined, "Interface impact: none"]) {
    assert.deepEqual(assertRoutingPolicy(paths, body, "push"), {
      paths, momi: true, moxi: true, root: false, cross: true,
    })
  }
})

test("missing or unsupported events fail for every path selection", () => {
  for (const paths of [[], ["README.md"], ["MoMi/services/orders/index.ts"],
    ["MoXi/src/App.tsx"], ["MoMi/README.md", "MoXi/README.md"]]) {
    for (const event of [undefined, "", "pull_request_target", "workflow_dispatch"]) {
      assert.throws(() => assertRoutingPolicy(
        paths, "Interface impact: preorder-v1 remains compatible", event,
      ), /event/i)
    }
  }
})

test("interface placeholders are not explicit statements", () => {
  assert.equal(hasExplicitInterfaceStatement("Interface impact: N/A"), false)
  assert.equal(hasExplicitInterfaceStatement("Interface impact: none"), false)
  assert.equal(hasExplicitInterfaceStatement("Interface impact: v2 schema"), true)
})

test("CLI passes the explicit event environment into routing policy", () => {
  const env = { ...process.env }
  delete env.MOXX_EVENT_NAME
  delete env.MOXX_PR_BODY
  const args = [fileURLToPath(new URL("../scripts/monorepo-routing.mjs", import.meta.url)),
    "--base", "HEAD", "--head", "HEAD"]
  const options = {
    cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", timeout: 10_000,
  }
  const push = spawnSync(process.execPath, args, {
    ...options, env: { ...env, MOXX_EVENT_NAME: "push" },
  })
  assert.equal(push.status, 0, push.stderr)
  assert.deepEqual(JSON.parse(push.stdout), {
    paths: [], momi: false, moxi: false, root: false, cross: false,
  })
  const missing = spawnSync(process.execPath, args, { ...options, env })
  assert.notEqual(missing.status, 0)
  assert.match(missing.stderr, /event/i)
})
