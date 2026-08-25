import { resolve } from "node:path";

import { readReleaseReceipt } from "../../scripts/release/read_release_receipt.ts";
import { runGit } from "./run_git.ts";
import type { ReleaseIdentity } from "./types.ts";

export function assertReleasedDev(path: string): ReleaseIdentity {
  const receiptPath = resolve(path);
  const receipt = readReleaseReceipt(receiptPath);
  const branch = runGit(["branch", "--show-current"]);
  const status = runGit(["status", "--porcelain"]);
  const head = runGit(["rev-parse", "HEAD"]);
  const tree = runGit(["rev-parse", "HEAD^{tree}"]);
  const originDev = runGit(["rev-parse", "origin/dev"]);
  if (
    branch !== "dev" || status !== "" || head !== originDev ||
    head !== receipt.head_sha || tree !== receipt.head_tree ||
    receipt.database !== "preview_apply_parity_complete"
  ) throw new Error("Publication requires the exact clean released dev tree");
  return { headSha: head, headTree: tree, receiptPath };
}
