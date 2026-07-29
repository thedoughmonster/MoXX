import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const manifests = [
  "services/trello-data-acquisition/functions/trello-board-snapshot-v1/function.json",
  "services/trello-data-acquisition/functions/trello-webhook-inventory-v1/function.json",
  "services/trello-task-delivery/functions/trello-create-list-v1/function.json",
  "services/trello-task-delivery/functions/trello-move-card-v1/function.json",
  "services/trello-task-delivery/functions/trello-register-webhook-v1/function.json",
]

test("POST-only Trello functions declare non-mutating hosted probes", async () => {
  for (const path of manifests) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8")
    const manifest = JSON.parse(source) as Record<string, unknown>
    assert.deepEqual(manifest.probe, {
      method: "GET",
      acceptable_statuses: [405],
    }, path)
  }
})
