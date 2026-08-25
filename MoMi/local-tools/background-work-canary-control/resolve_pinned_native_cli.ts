import { closeSync, fstatSync, lstatSync, openSync, readSync,
  realpathSync } from "node:fs"
import { constants } from "node:fs"
import { createRequire } from "node:module"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import type { NativeCliInstallation } from "./native_cli_installation_types.ts"
import { readBoundedRegularFile } from "./read_bounded_regular_file.ts"
import { MAX_REPOSITORY_CONTROL_FILE_BYTES, REQUIRED_SUPABASE_NATIVE_BYTES,
  REQUIRED_SUPABASE_VERSION } from "./repository_preflight_constants.ts"

export function resolvePinnedNativeCli(
  repositoryRoot: string,
): NativeCliInstallation {
  try {
    if (!isAbsolute(repositoryRoot) || resolve(repositoryRoot) !== repositoryRoot ||
      realpathSync(repositoryRoot) !== repositoryRoot || process.platform !== "linux" ||
      process.arch !== "x64") throw new Error()
    const nodeModules = join(repositoryRoot, "node_modules")
    const nodeModulesStat = lstatSync(nodeModules)
    if (!nodeModulesStat.isDirectory() || nodeModulesStat.isSymbolicLink() ||
      realpathSync(nodeModules) !== nodeModules) throw new Error()
    const wrapperRoot = realpathSync(join(nodeModules, "supabase"))
    const wrapperRelative = relative(nodeModules, wrapperRoot)
    if (!wrapperRelative || wrapperRelative.startsWith("..") ||
      isAbsolute(wrapperRelative) || !lstatSync(wrapperRoot).isDirectory()) throw new Error()
    const wrapper = JSON.parse(readBoundedRegularFile(
      join(wrapperRoot, "package.json"), MAX_REPOSITORY_CONTROL_FILE_BYTES,
    )) as Record<string, unknown>
    const wrapperBin = wrapper.bin as Record<string, unknown> | undefined
    const optional = wrapper.optionalDependencies as Record<string, unknown> | undefined
    if (wrapper.name !== "supabase" || wrapper.version !== REQUIRED_SUPABASE_VERSION ||
      wrapperBin?.supabase !== "dist/supabase.js" ||
      optional?.["@supabase/cli-linux-x64"] !== REQUIRED_SUPABASE_VERSION) throw new Error()
    const shim = join(wrapperRoot, "dist/supabase.js")
    const shimStat = lstatSync(shim)
    if (!shimStat.isFile() || shimStat.isSymbolicLink() || realpathSync(shim) !== shim) {
      throw new Error()
    }
    const manifestPath = createRequire(shim)
      .resolve("@supabase/cli-linux-x64/package.json")
    const nativeRoot = realpathSync(dirname(manifestPath))
    const nativeRelative = relative(nodeModules, nativeRoot)
    if (!nativeRelative || nativeRelative.startsWith("..") ||
      isAbsolute(nativeRelative) || !lstatSync(nativeRoot).isDirectory()) throw new Error()
    const native = JSON.parse(readBoundedRegularFile(
      join(nativeRoot, "package.json"), MAX_REPOSITORY_CONTROL_FILE_BYTES,
    )) as Record<string, unknown>
    const publish = native.publishConfig as Record<string, unknown> | undefined
    if (native.name !== "@supabase/cli-linux-x64" ||
      native.version !== REQUIRED_SUPABASE_VERSION ||
      JSON.stringify(native.os) !== '["linux"]' || JSON.stringify(native.cpu) !== '["x64"]' ||
      JSON.stringify(native.libc) !== '["glibc"]' || JSON.stringify(native.files) !== '["bin/"]' ||
      JSON.stringify(publish?.executableFiles) !== '["bin/supabase","bin/supabase-go"]') {
      throw new Error()
    }
    const lock = readBoundedRegularFile(
      join(repositoryRoot, "pnpm-lock.yaml"), MAX_REPOSITORY_CONTROL_FILE_BYTES,
    )
    if ([...lock.matchAll(/\n  '@supabase\/cli-linux-x64@2\.109\.1':\n/g)].length !== 2 ||
      [...lock.matchAll(/\n      '@supabase\/cli-linux-x64': 2\.109\.1\n/g)].length !== 1 ||
      !lock.includes("resolution: {integrity: sha512-svFmamF/vIq4/oinwY50jDi869itC9/" +
        "GWrPaGtsHFkK4NUBcQtl1T37WWIivGsXwbBKNC4FjZD3dGqjL7bfW1g==}")) {
      throw new Error()
    }
    const sourcePath = join(nativeRoot, "bin/supabase")
    const source = lstatSync(sourcePath, { bigint: true })
    if (!source.isFile() || source.isSymbolicLink() || source.size !== BigInt(
      REQUIRED_SUPABASE_NATIVE_BYTES,
    ) || (source.mode & 0o111n) === 0n || (source.mode & 0o022n) !== 0n ||
      source.uid !== BigInt(process.getuid?.() ?? -1) ||
      realpathSync(sourcePath) !== sourcePath) throw new Error()
    const fd = openSync(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      const held = fstatSync(fd, { bigint: true })
      const header = Buffer.alloc(20)
      if (held.dev !== source.dev || held.ino !== source.ino ||
        readSync(fd, header, 0, header.length, 0) !== header.length ||
        !header.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) ||
        header[4] !== 2 || header[5] !== 1 || header.readUInt16LE(18) !== 62) throw new Error()
    } finally { closeSync(fd) }
    return { sourcePath, device: source.dev, inode: source.ino, size: Number(source.size) }
  } catch {
    throw new Error("Pinned native provider CLI is unavailable or unsafe")
  }
}
