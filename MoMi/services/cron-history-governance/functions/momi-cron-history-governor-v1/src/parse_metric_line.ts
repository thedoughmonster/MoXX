import type { MetricPoint } from "./types.ts";

const metricLine =
  /^([A-Za-z_:][A-Za-z0-9_:]*)(?:\{([^}]*)\})?\s+([^\s]+)(?:\s+\d+)?$/u;

export function parseMetricLine(line: string): MetricPoint | null {
  const match = line.match(metricLine);
  if (!match) return null;
  const value = Number(match[3]);
  if (!Number.isFinite(value)) return null;
  const labels: Record<string, string> = {};
  const source = match[2] ?? "";
  let index = 0;
  while (index < source.length) {
    const code = source.charCodeAt(index);
    const startsName = code === 95 || code >= 65 && code <= 90 ||
      code >= 97 && code <= 122;
    if (!startsName) {
      index += 1;
      continue;
    }
    const nameStart = index;
    index += 1;
    while (index < source.length) {
      const next = source.charCodeAt(index);
      if (!(next === 95 || next >= 48 && next <= 57 ||
        next >= 65 && next <= 90 || next >= 97 && next <= 122)) break;
      index += 1;
    }
    const name = source.slice(nameStart, index);
    if (source[index] !== "=" || source[index + 1] !== '"') continue;
    index += 2;
    let decoded = "";
    let closed = false;
    while (index < source.length) {
      const character = source[index];
      index += 1;
      if (character === '"') {
        closed = true;
        break;
      }
      if (character !== "\\" || index >= source.length) {
        decoded += character;
        continue;
      }
      const escaped = source[index];
      index += 1;
      if (escaped === "n") decoded += "\n";
      else if (escaped === '"') decoded += '"';
      else if (escaped === "\\") decoded += "\\";
      else decoded += `\\${escaped}`;
    }
    if (!closed) break;
    labels[name] = decoded;
  }
  return { name: match[1], labels, value };
}
