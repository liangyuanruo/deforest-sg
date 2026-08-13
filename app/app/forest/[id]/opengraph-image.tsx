import { getForestPathIds } from "@/lib/forests-server";
import { renderForestParamImage } from "@/lib/og";

export const alt = "A Singapore forest under Master Plan 2025";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Prerender every card at build time. This isn't just for speed: it moves the
// on-disk data read to build time, where `public/data/` is present — a
// request-time read would rely on the file being traced into the serverless
// function, which isn't guaranteed for a dynamic path.
export async function generateStaticParams() {
  const ids = await getForestPathIds();
  return ids.map((id) => ({ id }));
}

/** Per-forest Open Graph card — vulnerable patch (numeric id) or already-cleared
 *  forest (UUID); falls back to the generic card for an unknown id. */
export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return renderForestParamImage(id);
}
