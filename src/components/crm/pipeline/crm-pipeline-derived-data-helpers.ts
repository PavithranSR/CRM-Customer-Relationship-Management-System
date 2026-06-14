export function readPipelineTagValue(tags: string | null, key: string) {
  if (!tags) return "";

  const marker = "__client_meta__:";
  const markerIndex = tags.indexOf(marker);
  const keyAliases: Record<string, string[]> = {
    city: ["city", "City", "CITY", "clientCity", "addressCity", "town", "locationCity"],
    country: ["country", "Country", "COUNTRY", "clientCountry", "addressCountry", "nation"],
  };
  const candidates = keyAliases[key] || [key];

  if (markerIndex >= 0) {
    let metaRaw = tags.slice(markerIndex + marker.length).trim();
    if (metaRaw.startsWith("\"") && metaRaw.endsWith("\"")) {
      metaRaw = metaRaw.slice(1, -1);
    }
    metaRaw = metaRaw.replace(/\\"/g, "\"");

    try {
      const parsed = JSON.parse(metaRaw) as Record<string, unknown>;
      for (const candidate of candidates) {
        const directValue = parsed[candidate];
        if (typeof directValue === "string" && directValue.trim()) return directValue.trim();
      }

      for (const [metaKey, metaValue] of Object.entries(parsed)) {
        if (
          candidates.some((candidate) => candidate.toLowerCase() === metaKey.toLowerCase()) &&
          typeof metaValue === "string" &&
          metaValue.trim()
        ) {
          return metaValue.trim();
        }
      }
    } catch {
      // Keep the fallback parsing below for older tag formats.
    }
  }

  const parts = tags
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const found = parts.find((item) => {
    const lower = item.toLowerCase();
    return candidates.some((candidate) => lower.startsWith(`${candidate.toLowerCase()}:`));
  });

  return found ? found.split(":").slice(1).join(":").trim() : "";
}

