import { spawnSync } from "node:child_process";

export function runGit(args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Unable to verify released dev tree");
  return result.stdout.trim();
}
