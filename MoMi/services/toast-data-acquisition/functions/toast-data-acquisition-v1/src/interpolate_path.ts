export function interpolateRegisteredPath(
  template: string,
  pathParameters: Record<string, string>,
): string {
  const used = new Set<string>();
  const path = template.replace(/\{([^{}]+)\}/g, (_match, key: string) => {
    const value = pathParameters[key];
    if (value === undefined) {
      throw new Error(`Registered path parameter ${key} is missing`);
    }
    if (value === "." || value === "..") {
      throw new Error(`Registered path parameter ${key} is invalid`);
    }
    used.add(key);
    return encodeURIComponent(value);
  });
  if (
    path.includes("{") || path.includes("}") ||
    Object.keys(pathParameters).some((key) => !used.has(key))
  ) {
    throw new Error("Registered path interpolation is incomplete");
  }
  return path;
}
