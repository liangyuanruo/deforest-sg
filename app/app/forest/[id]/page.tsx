import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Explorer } from "@/components/Explorer";
import { formatHa, formatPercent } from "@/lib/format";
import { getForestById, getForestIds } from "@/lib/forests-server";

type ForestParams = { params: Promise<{ id: string }> };

/**
 * Prerender a static `/forest/<id>` for every threatened patch at build time.
 * The set is small (~600) and fixed per data release, so this stays cheap and
 * gives crawlers a ready-rendered page with the forest's own metadata + OG card.
 */
export async function generateStaticParams() {
  const ids = await getForestIds();
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({
  params,
}: ForestParams): Promise<Metadata> {
  const { id } = await params;
  const site = await getForestById(Number(id));
  if (!site) return {};

  const title = `${site.label} — Deforest SG`;
  const description = `${formatHa(site.area_ha)} of ${site.label} (${formatPercent(
    site.threatened_fraction,
  )} of the patch) is zoned for development under Singapore's URA Master Plan 2025.`;

  // The colocated `opengraph-image.tsx` / `twitter-image.tsx` supply the images;
  // `url` resolves to an absolute canonical link via the layout's metadataBase.
  return {
    title,
    description,
    openGraph: { title, description, url: `/forest/${site.id}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ForestPage({ params }: ForestParams) {
  const { id } = await params;
  const numId = Number(id);
  const site = await getForestById(numId);
  if (!site) notFound();

  // Same client app as `/`, but preselected to this forest (flies the map to it
  // and opens its detail card). The client then keeps the URL in sync.
  return <Explorer initialSelectedId={numId} />;
}
