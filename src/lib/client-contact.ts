const GENERATED_EMAIL_DOMAIN = "no-email.local";

function buildEmailSlug(name?: string | null) {
  const slug = (name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "contact";
}

export function isGeneratedClientEmail(email?: string | null) {
  return typeof email === "string" && email.endsWith(`@${GENERATED_EMAIL_DOMAIN}`);
}

export function createFallbackClientEmail(name?: string | null) {
  return `${buildEmailSlug(name)}-${crypto.randomUUID().slice(0, 8)}@${GENERATED_EMAIL_DOMAIN}`;
}

export function normalizeClientEmailForStorage(email?: string | null, name?: string | null) {
  const trimmedEmail = email?.trim().toLowerCase();
  return trimmedEmail || createFallbackClientEmail(name);
}

export function getDisplayClientEmail(email?: string | null) {
  if (!email || isGeneratedClientEmail(email)) {
    return "";
  }

  return email.trim();
}
