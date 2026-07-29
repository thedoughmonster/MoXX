import { readFile } from "node:fs/promises";

import type { JsonValue } from "./types.ts";

export async function loadConfig(path: string): Promise<JsonValue> {
  return JSON.parse(await readFile(path, "utf8")) as JsonValue;
}
