import { parseMetricLine } from "./parse_metric_line.ts";
import type { ProviderMetricSample } from "./types.ts";

const wholeDisk = /^(?:nvme\d+n\d+|[svx]d[a-z]+)$/u;
const acceptedMount = /^(?:\/|\/data|\/var\/lib\/postgresql(?:\/data)?)$/u;

export function reduceMetrics(
  text: string,
  observedAt: string,
  warningNames: string[],
): ProviderMetricSample {
  let cpuTotal = 0;
  let cpuIdle = 0;
  let memoryTotal = Number.NaN;
  let memoryAvailable = Number.NaN;
  let swapTotal = Number.NaN;
  let swapFree = Number.NaN;
  let ioWhole = 0;
  let ioFallback = 0;
  let connections = 0;
  let connectionFound = false;
  let warningFound = 0;
  let providerWarning = false;
  const filesystems = new Map<string, { size?: number; available?: number }>();
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const point = parseMetricLine(line);
    if (!point) continue;
    if (point.name === "node_cpu_seconds_total") {
      cpuTotal += point.value;
      if (point.labels.mode === "idle") cpuIdle += point.value;
    } else if (point.name === "node_memory_MemTotal_bytes") {
      memoryTotal = Math.max(
        Number.isFinite(memoryTotal) ? memoryTotal : 0,
        point.value,
      );
    } else if (point.name === "node_memory_MemAvailable_bytes") {
      memoryAvailable = Math.max(
        Number.isFinite(memoryAvailable) ? memoryAvailable : 0,
        point.value,
      );
    } else if (point.name === "node_memory_SwapTotal_bytes") {
      swapTotal = Math.max(
        Number.isFinite(swapTotal) ? swapTotal : 0,
        point.value,
      );
    } else if (point.name === "node_memory_SwapFree_bytes") {
      swapFree = Math.max(
        Number.isFinite(swapFree) ? swapFree : 0,
        point.value,
      );
    } else if (point.name === "node_disk_io_time_seconds_total") {
      const device = point.labels.device ?? "";
      if (!/^(?:loop|ram|fd|sr)/u.test(device)) ioFallback += point.value;
      if (wholeDisk.test(device)) ioWhole += point.value;
    } else if (
      point.name === "pg_stat_database_num_backends" ||
      point.name === "pg_stat_database_numbackends"
    ) {
      if (!point.labels.datname || point.labels.datname === "postgres") {
        connections += point.value;
        connectionFound = true;
      }
    } else if (
      point.name === "node_filesystem_size_bytes" ||
      point.name === "node_filesystem_avail_bytes"
    ) {
      const mount = point.labels.mountpoint ?? "";
      if (!acceptedMount.test(mount)) continue;
      const key = `${point.labels.device ?? ""}|${mount}`;
      const current = filesystems.get(key) ?? {};
      if (point.name.endsWith("size_bytes")) current.size = point.value;
      else current.available = point.value;
      filesystems.set(key, current);
    }
    const warningIndex = warningNames.indexOf(point.name);
    if (warningIndex >= 0) {
      warningFound |= 1 << Math.min(warningIndex, 30);
      if (point.value > 0) providerWarning = true;
    }
  }
  let diskPct = Number.NaN;
  for (const filesystem of filesystems.values()) {
    if (!filesystem.size || filesystem.available === undefined) continue;
    diskPct = Math.max(
      Number.isFinite(diskPct) ? diskPct : 0,
      (1 - filesystem.available / filesystem.size) * 100,
    );
  }
  const warningMask = warningNames.length > 0 && warningNames.length <= 30
    ? (1 << warningNames.length) - 1
    : -1;
  const warningComplete = warningMask >= 0 && warningFound === warningMask;
  const complete = cpuTotal > 0 && cpuIdle >= 0 && memoryTotal > 0 &&
    memoryAvailable >= 0 && swapTotal >= 0 && swapFree >= 0 &&
    (ioWhole > 0 || ioFallback > 0) && Number.isFinite(diskPct) &&
    connectionFound && connections >= 0 && warningComplete;
  return {
    sourceObservedAt: observedAt,
    cpuTotalSeconds: cpuTotal > 0 ? cpuTotal : null,
    cpuIdleSeconds: cpuTotal > 0 ? cpuIdle : null,
    ramPct: memoryTotal > 0 && memoryAvailable >= 0
      ? (1 - memoryAvailable / memoryTotal) * 100
      : null,
    swapUsedBytes: swapTotal >= 0 && swapFree >= 0
      ? swapTotal - swapFree
      : null,
    ioBusySeconds: ioWhole > 0 ? ioWhole : ioFallback > 0 ? ioFallback : null,
    allocatedDiskPct: Number.isFinite(diskPct) ? diskPct : null,
    providerConnections: connectionFound ? connections : null,
    providerWarning: warningComplete ? providerWarning : null,
    sourceComplete: complete,
  };
}
