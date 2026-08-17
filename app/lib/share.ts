/**
 * Pure, framework-agnostic share-link helpers. Kept free of React and `window`
 * so both server code (root layout's `metadataBase`) and the client
 * `ShareButton` can import it, unit tested without a DOM.
 */

/** Fallback origin when no Vercel domain is exposed. Prefer
 *  {@link productionBaseUrl}, which reads the canonical injected domain. */
export const SITE_URL = "https://deforest.sg";

/**
 * Canonical production origin, from Vercel's injected
 * `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` (the stable production domain, not
 * the per-deploy `VERCEL_URL`, so preview-deploy shares still point at prod).
 * `null` off Vercel, where callers fall back to `SITE_URL` / `window.location.origin`.
 */
export function productionBaseUrl(): string | null {
  const host = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : null;
}

/** Channels the share menu offers. `native` is the Web Share sheet — how
 *  Instagram is reached, since it has no link-prefill URL. */
export type ShareChannel = "whatsapp" | "telegram" | "copy" | "native";

/** `utm_source` per channel, kept distinct from the channel key so the
 *  analytics label can drift from the code identifier if needed. */
const UTM_SOURCE: Record<ShareChannel, string> = {
  whatsapp: "whatsapp",
  telegram: "telegram",
  copy: "copy_link",
  native: "web_share",
};

/** In-app path for a forest (or root when none selected). `id` is a numeric
 *  OSM id (threatened) or UUID (already-cleared) — both live under `/forest/[id]`. */
export function forestPath(id: number | string | null): string {
  return id === null ? "/" : `/forest/${id}`;
}

/**
 * Absolute, UTM-tagged URL to share for the given forest (or the app root).
 * `origin` is the live origin at share time; pass `SITE_URL` as a fallback.
 */
export function buildShareUrl(
  origin: string,
  id: number | string | null,
  channel: ShareChannel,
): string {
  const url = new URL(forestPath(id), origin);
  url.searchParams.set("utm_source", UTM_SOURCE[channel]);
  url.searchParams.set("utm_medium", "share");
  url.searchParams.set("utm_campaign", id === null ? "app_share" : "forest_share");
  return url.toString();
}

/** Message that rides along with the link. `cleared` forests get past-tense
 *  phrasing; threatened patches are still at risk. */
export function shareText(label: string | null, cleared = false): string {
  if (!label) return "Which forests will Singapore lose to development?";
  return cleared
    ? `${label} is a Singapore forest already cleared for development.`
    : `${label} is among the Singapore forests zoned for development.`;
}

/** `wa.me/?text=` (no phone number) opens WhatsApp's compose sheet pre-filled,
 *  on web and mobile. */
export function whatsappHref(shareUrl: string, text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`;
}

/** Telegram share deep-link. `t.me/share/url` takes the link and message as
 *  separate params so Telegram renders its own link preview. */
export function telegramHref(shareUrl: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(
    shareUrl,
  )}&text=${encodeURIComponent(text)}`;
}
