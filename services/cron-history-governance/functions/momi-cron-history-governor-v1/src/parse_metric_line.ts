import type { MetricPoint } from "./types.ts";

const metricLine =
  /^([A-Za-z_:][A-Za-z0-9_:]*)(?:\{([^}]*)\})?\s+([^\s]+)(?:\s+\d+)?$/u;
const label = /([A-Za-z_][A-Za-z0-9_]*)="((?:\\.|[^"])*)"/gu;

export function parseMetricLine(line: string): MetricPoint | null {
  const match = line.match(metricLine);
  if (!match) return null;
  const value = Number(match[3]);
  if (!Number.isFinite(value)) return null;
  const labels: Record<string, string> = {};
  if (match[2]) {
    let item: RegExpExecArray | null;
    while ((item = label.exec(match[2])) !== null) {
      labels[item[1]] = item[2]
        .replaceAll("\\n", "\n")
        .replaceAll('\\"', '"')
        .replaceAll("\\\\", "\\");
    }
    label.lastIndex = 0;
  }
  return { name: match[1], labels, value };
}
