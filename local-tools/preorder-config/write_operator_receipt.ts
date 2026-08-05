import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { OperatorReceipt } from "./types.ts";

export async function writeOperatorReceipt(
  receipt: OperatorReceipt,
): Promise<string> {
  const directory = resolve(".momi/preorder-config");
  const path = resolve(directory, `${receipt.run_id}.json`);
  const temporary = resolve(directory, `.${receipt.run_id}.${process.pid}.tmp`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  await writeFile(temporary, `${JSON.stringify(receipt, null, 2)}\n`, {
    flag: "wx", mode: 0o600,
  });
  await rename(temporary, path);
  await chmod(path, 0o600);
  return path;
}
