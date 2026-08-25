import { homedir } from "node:os"

import { prepareReceiptRootForHome } from "./prepare_receipt_root_for_home.ts"

export async function prepareReceiptRoot(): Promise<string> {
  return await prepareReceiptRootForHome(homedir())
}
