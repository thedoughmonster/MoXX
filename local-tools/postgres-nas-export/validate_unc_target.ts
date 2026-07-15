import { win32 } from "node:path"

export function validateUncTarget(target: string, repositoryRoot: string): void {
  if (target !== target.trim() || target.includes("/")) {
    throw new Error("--target must be an exact Windows UNC path")
  }
  if (!target.startsWith("\\\\") || /^\\\\[?.]\\/.test(target)) {
    throw new Error("--target must be an absolute UNC path, not a device or local path")
  }
  const parts = target.slice(2).split("\\")
  if (parts.at(-1) === "") parts.pop()
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error("--target must include a UNC server and share")
  }
  for (const part of parts) {
    const base = part.split(".", 1)[0]
    if (part === "." || part === ".." || /[\x00-\x1f<>:"|?*]/.test(part) ||
      part.endsWith(".") || part.endsWith(" ") ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)) {
      throw new Error("--target contains traversal or an unsafe Windows path segment")
    }
  }
  const normalized = win32.normalize(target).replace(/\\+$/, "").toLowerCase()
  const supplied = target.replace(/\\+$/, "").toLowerCase()
  if (normalized !== supplied) throw new Error("--target must already be normalized")
  const localNames = new Set([".", "localhost", "127.0.0.1", "::1"])
  if (process.env.COMPUTERNAME) localNames.add(process.env.COMPUTERNAME.toLowerCase())
  if (localNames.has(parts[0].toLowerCase())) {
    throw new Error("--target must be a remote NAS, not a share on this workstation")
  }
  const repository = win32.resolve(repositoryRoot)
  const relative = win32.relative(repository, win32.resolve(target))
  if (relative === "" || (!relative.startsWith("..") && !win32.isAbsolute(relative))) {
    throw new Error("--target cannot be the repository or a directory inside it")
  }
}
