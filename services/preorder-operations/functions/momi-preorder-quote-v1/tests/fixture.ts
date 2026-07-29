import { readFile } from "node:fs/promises";

export const fixture = JSON.parse(
  await readFile(
    new URL("../../../fixtures/quote-exchange.json", import.meta.url),
    "utf8",
  ),
) as {
  request: Record<string, unknown>;
  response: { outcome: "accepted"; quote: Record<string, unknown> };
};
