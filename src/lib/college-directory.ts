export interface CollegeLocationParts {
  country: string | null;
  state: string | null;
  districtCity: string | null;
  placeArea: string | null;
  collegeName: string | null;
}

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

export function formatCollegeLocation(parts: CollegeLocationParts) {
  const segments = [
    clean(parts.collegeName),
    clean(parts.placeArea),
    clean(parts.districtCity),
    clean(parts.state),
    clean(parts.country),
  ].filter(Boolean);

  return segments.join(" • ");
}

export function formatCollegeLocationPath(parts: CollegeLocationParts) {
  const segments = [
    clean(parts.country),
    clean(parts.state),
    clean(parts.districtCity),
    clean(parts.placeArea),
  ].filter(Boolean);

  return segments.join(" / ");
}

export function normalizeCollegeLocationValue(value: string | null | undefined) {
  return clean(value).toLowerCase();
}
