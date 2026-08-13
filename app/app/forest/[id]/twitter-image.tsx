import { getForestPathIds } from "@/lib/forests-server";
import { renderForestParamImage } from "@/lib/og";

export const alt = "A Singapore forest under Master Plan 2025";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Prerender at build time — see the note in opengraph-image.tsx.
export async function generateStaticParams() {
  const ids = await getForestPathIds();
  return ids.map((id) => ({ id }));
}

/** Per-forest Twitter card — same art as the Open Graph image. */
export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return renderForestParamImage(id);
}
