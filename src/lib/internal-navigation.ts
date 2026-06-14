const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

export function isSafeInternalHref(value: string | null | undefined): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim();
  return normalized.startsWith("/") && !normalized.startsWith("//") && !ABSOLUTE_URL_PATTERN.test(normalized);
}

export function resolveInternalBackHref(candidate: string | null | undefined, fallbackHref: string) {
  return isSafeInternalHref(candidate) ? candidate : fallbackHref;
}

export function withInternalBackHref(href: string, backHref: string | null | undefined) {
  if (!isSafeInternalHref(href) || !isSafeInternalHref(backHref)) {
    return href;
  }

  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const baseHref = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const [pathname, search = ""] = baseHref.split("?");
  const params = new URLSearchParams(search);

  params.set("from", backHref);

  const queryString = params.toString();
  return `${pathname}${queryString ? `?${queryString}` : ""}${hash}`;
}
