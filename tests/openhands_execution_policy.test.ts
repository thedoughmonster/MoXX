import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("requires agent-owned review, merge, and development release", async () => {
  const contract = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8")
  const workflow = await readFile(
    new URL("../docs/openhands-execution-workflow.md", import.meta.url), "utf8")
  const skill = await readFile(
    new URL("../.agents/skills/momi-execution/SKILL.md", import.meta.url), "utf8")
  const hook = await readFile(
    new URL("../.openhands/hooks/on_stop.sh", import.meta.url), "utf8")
  for (const source of [contract, workflow, skill]) {
    assert.match(source, /merge.*`dev`/s)
    assert.match(source, /review/s)
    assert.match(source, /development release/s)
    assert.match(source, /production/s)
  }
  assert.match(hook, /pr_state.*MERGED/s)
  assert.match(hook, /mergeCommit/)
  assert.match(hook, /unresolved review threads/)
  assert.match(hook, /validation-receipt\.json/)
  assert.match(hook, /head_sha.*LOCAL_SHA/s)
  assert.match(hook, /validate-final/)
})
