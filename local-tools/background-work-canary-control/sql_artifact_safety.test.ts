import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { parse } from "pgsql-ast-parser"
import {
  FAST_SQL_FILENAME,
  RESOURCE_SQL_FILENAME,
  SQL_ARTIFACT_DIRECTORY,
} from "./sql_artifact_constants.ts"

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "../..")

test("SQL artifacts are single-statement read-only sanitized SELECTs", () => {
  for (const filename of [FAST_SQL_FILENAME, RESOURCE_SQL_FILENAME]) {
    const sql = readFileSync(join(sourceRoot, SQL_ARTIFACT_DIRECTORY, filename), "utf8")
    assert.match(sql, /^with\n/)
    assert.equal((sql.match(/;/g) ?? []).length, 1)
    assert.deepEqual(parse(sql).map((statement) => statement.type), ["with"])
    assert.doesNotMatch(sql, /\b(insert|update|delete|alter|drop|create|truncate|lock|call)\b/i)
    assert.doesNotMatch(sql, /(https?:\/\/|access[_-]?token|password|return_message|payload)/i)
    if (filename === FAST_SQL_FILENAME) assert.match(sql, /md5\(j\.command\)/)
  }
})
