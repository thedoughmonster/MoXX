import assert from "node:assert/strict"
import test from "node:test"

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

test("cross-product changes select both and require interface evidence", () => {
  const paths = ["MoMi/services/preorder/index.ts", "MoXi/src/api/preorder.ts"]
  assert.throws(() => assertRoutingPolicy(paths, "Interface impact: none"))
  assert.deepEqual(
    assertRoutingPolicy(paths, "Interface impact: preorder-v1 remains compatible"),
    { paths, momi: true, moxi: true, root: false, cross: true },
  )
})

test("interface placeholders are not explicit statements", () => {
  assert.equal(hasExplicitInterfaceStatement("Interface impact: N/A"), false)
  assert.equal(hasExplicitInterfaceStatement("Interface impact: none"), false)
  assert.equal(hasExplicitInterfaceStatement("Interface impact: v2 schema"), true)
})
