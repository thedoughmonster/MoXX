export type NativeCliInstallation = Readonly<{
  sourcePath: string
  device: bigint
  inode: bigint
  size: number
}>

export type HeldNativeSnapshot = Readonly<{
  fd: number
  directory: string
  device: bigint
  inode: bigint
  size: number
}>
