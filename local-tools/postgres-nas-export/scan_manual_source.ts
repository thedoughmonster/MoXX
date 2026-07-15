import { realpath } from "node:fs/promises"
import { win32 } from "node:path"

import { MANUAL_DIRECTORY } from "./constants.ts"
import { scanDirectoryFiles } from "./scan_directory_files.ts"
import type { ScannedFile } from "./types.ts"

export async function scanManualSource(
  directory: string,
  repositoryRoot: string,
): Promise<ScannedFile[]> {
  if (directory !== directory.trim() || directory.includes("/") ||
    !/^[a-zA-Z]:\\/.test(directory) || /^\\\\[?.]\\/.test(directory)) {
    throw new Error("--manual-export-dir must be an exact absolute local Windows path")
  }
  const supplied = directory.replace(/\\+$/, "").toLowerCase()
  const normalized = win32.normalize(directory).replace(/\\+$/, "").toLowerCase()
  if (supplied !== normalized || win32.parse(directory).root.toLowerCase() === normalized) {
    throw new Error("--manual-export-dir must be normalized and cannot be a drive root")
  }
  const parts = directory.slice(win32.parse(directory).root.length).split("\\").filter(Boolean)
  for (const part of parts) {
    const base = part.split(".", 1)[0]
    if (part === "." || part === ".." || /[\x00-\x1f<>:"|?*]/.test(part) ||
      part.endsWith(".") || part.endsWith(" ") ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)) {
      throw new Error("--manual-export-dir contains an unsafe Windows path segment")
    }
  }
  const resolvedDirectory = (await realpath(directory)).replace(/^\\\\\?\\/, "")
  const resolvedRepository = (await realpath(repositoryRoot)).replace(/^\\\\\?\\/, "")
  const relative = win32.relative(resolvedRepository, resolvedDirectory)
  if (relative === "" || (!relative.startsWith("..") && !win32.isAbsolute(relative))) {
    throw new Error("--manual-export-dir cannot be the repository or a directory inside it")
  }
  return (await scanDirectoryFiles(directory, MANUAL_DIRECTORY)).files
}
