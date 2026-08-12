import { getForestById, getForestIds } from "@/lib/forests-server";
import { renderForestOgImage, renderOgImage } from "@/lib/og";

export const alt = "A Singapore forest zoned for development under Master Plan 2025";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Prerender every card at build time. This isn't just for speed: it moves the
// on-disk data read to build time, where `public/data/` is present — a
// request-time read would rely on the file being traced into the serverless
// function, which isn't guaranteed for a dynamic path.
export async function generateStaticParams() {
  const ids = await getForestIds();
  return ids.map((id) => ({ id: String(id) }));
}

/** Per-forest Open Graph card. Falls back to the generic card if the id is
 *  somehow unknown (e.g. a stale link), so a preview always renders. */
export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const site = await getForestById(Number(id));
  return site ? renderForestOgImage(site) : renderOgImage();
}
