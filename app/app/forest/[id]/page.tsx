import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Explorer } from "@/components/Explorer";
import { formatHa, formatPercent } from "@/lib/format";
import {
  getClearedByUid,
  getForestById,
  getForestPathIds,
  isThreatenedIdParam,
} from "@/lib/forests-server";

type ForestParams = { params: Promise<{ id: string }> };

/**
 * Prerender a static `/forest/<id>` for every threatened patch (numeric id) and
 * every already-cleared forest (UUID) at build time. The set is small (~600 + 2)
 * and fixed per data release, so this stays cheap and gives crawlers a
 * ready-rendered page with each forest's own metadata + OG card.
 */
export async function generateStaticParams() {
  const ids = await getForestPathIds();
  return ids.map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: ForestParams): Promise<Metadata> {
  const { id } = await params;

  if (isThreatenedIdParam(id)) {
    const site = await getForestById(Number(id));
    if (!site) return {};

    const title = `${site.label} — Deforest SG`;
    const description = `${formatHa(site.area_ha)} of ${site.label} (${formatPercent(
      site.threatened_fraction,
    )} of the patch) is zoned for development under Singapore's Master Plan 2025.`;

    // The colocated `opengraph-image.tsx` / `twitter-image.tsx` supply the images;
    // `url` resolves to an absolute canonical link via the layout's metadataBase.
    return {
      title,
      description,
      openGraph: { title, description, url: `/forest/${site.id}` },
      twitter: { card: "summary_large_image", title, description },
    };
  }

  const cleared = await getClearedByUid(id);
  if (!cleared) return {};

  const title = `${cleared.name} — Deforest SG`;
  const zoned = cleared.dominant_lu_desc
    ? `, now zoned ${cleared.dominant_lu_desc}`
    : "";
  const description = `${formatHa(cleared.area_ha)} of ${cleared.name} — a Singapore secondary forest already cleared for development under Master Plan 2025${zoned}.`;

  return {
    title,
    description,
    openGraph: { title, description, url: `/forest/${cleared.uid}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ForestPage({ params }: ForestParams) {
  const { id } = await params;

  // Same client app as `/`, but preselected to this forest (flies the map to it
  // and opens its detail card). The client then keeps the URL in sync. Threatened
  // patches key on a numeric id; already-cleared forests key on their UUID.
  if (isThreatenedIdParam(id)) {
    const numId = Number(id);
    const site = await getForestById(numId);
    if (!site) notFound();
    return <Explorer initialSelectedId={numId} />;
  }

  const cleared = await getClearedByUid(id);
  if (!cleared) notFound();
  return <Explorer initialSelectedClearedUid={id} />;
}
