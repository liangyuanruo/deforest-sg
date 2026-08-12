/**
 * Pure, framework-agnostic helpers for building share links.
 *
 * Kept free of React and `window` so it can be imported from both server code
 * (the root layout's `metadataBase`) and the client `ShareButton`, and unit
 * tested without a DOM. The single source of truth for the deployed origin and
 * for how a forest is encoded in the URL (`/forest/<id>`), plus the per-channel
 * UTM tagging that Vercel Web Analytics reads.
 */

/** Last-resort origin when no Vercel domain is exposed (e.g. a non-Vercel host).
 *  Prefer {@link productionBaseUrl}, which reads the canonical domain Vercel
 *  injects, so this literal is only a fallback. */
export const SITE_URL = "https://deforest-sg.vercel.app";

/**
 * The canonical production origin, from the domain Vercel injects. Vercel sets
 * `VERCEL_PROJECT_PRODUCTION_URL` to the stable production domain (the custom
 * domain if one is attached, else the `*.vercel.app` one) and, for Next.js,
 * also exposes it to the browser bundle as
 * `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`. Using the *production* domain
 * (not the per-deploy `VERCEL_URL`) means links shared from a preview deploy
 * still point at production. Returns `null` off Vercel (e.g. local dev), where
 * callers fall back to `SITE_URL` or the live `window.location.origin`.
 */
export function productionBaseUrl(): string | null {
  const host = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : null;
}

/** Channels the share menu offers. `native` is the Web Share sheet (mobile),
 *  which is how Instagram is reached — Instagram has no link-prefill URL. */
export type ShareChannel = "whatsapp" | "telegram" | "copy" | "native";

/** `utm_source` value stamped per channel so shares are attributable in
 *  analytics. Kept distinct from the channel key so the analytics label can
 *  drift from the code identifier if needed. */
const UTM_SOURCE: Record<ShareChannel, string> = {
  whatsapp: "whatsapp",
  telegram: "telegram",
  copy: "copy_link",
  native: "web_share",
};

/** The in-app path that deep-links to a forest (or the app root when none is
 *  selected). Selecting a forest mirrors this into the address bar. */
export function forestPath(id: number | null): string {
  return id === null ? "/" : `/forest/${id}`;
}

/**
 * Absolute, UTM-tagged URL to share for the given forest (or the app root).
 * `origin` is the live origin at share time; pass `SITE_URL` as a fallback.
 */
export function buildShareUrl(
  origin: string,
  id: number | null,
  channel: ShareChannel,
): string {
  const url = new URL(forestPath(id), origin);
  url.searchParams.set("utm_source", UTM_SOURCE[channel]);
  url.searchParams.set("utm_medium", "share");
  url.searchParams.set("utm_campaign", id === null ? "app_share" : "forest_share");
  return url.toString();
}

/** The human-readable message that rides along with the link on WhatsApp,
 *  Telegram, and the native share sheet. */
export function shareText(label: string | null): string {
  return label
    ? `${label} is among the Singapore forests zoned for development.`
    : "Which forests will Singapore lose to development?";
}

/** WhatsApp share deep-link. `wa.me/?text=` (no phone number) opens the app's
 *  share/compose sheet with the message pre-filled — works on web and mobile. */
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
