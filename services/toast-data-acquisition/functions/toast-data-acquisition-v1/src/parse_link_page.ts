export function parseLinkNextPage(
  linkHeader: string,
  requestUrl: string,
): number | null {
  const nextPart = linkHeader.split(",").find((part) =>
    /;\s*rel=(?:"next"|next)(?:;|\s|$)/i.test(part)
  );
  if (!nextPart) return null;
  const match = nextPart.match(/<([^>]+)>/);
  if (!match) throw new Error("Toast pagination Link header is invalid");
  const requested = new URL(requestUrl);
  const linked = new URL(match[1]);
  if (
    linked.origin !== requested.origin || linked.pathname !== requested.pathname
  ) {
    throw new Error("Toast pagination Link left the registered endpoint");
  }
  const value = linked.searchParams.get("page");
  if (!value || !/^[1-9][0-9]*$/.test(value)) {
    throw new Error("Toast pagination Link has an invalid page");
  }
  const page = Number(value);
  if (!Number.isSafeInteger(page)) {
    throw new Error("Toast pagination page is too large");
  }
  const requestedValue = requested.searchParams.get("page") ?? "1";
  if (!/^[1-9][0-9]*$/.test(requestedValue)) {
    throw new Error("Toast pagination request has an invalid page");
  }
  const requestedPage = Number(requestedValue);
  if (!Number.isSafeInteger(requestedPage)) {
    throw new Error("Toast pagination request page is too large");
  }
  if (page <= requestedPage) {
    throw new Error("Toast pagination Link did not advance");
  }
  return page;
}
