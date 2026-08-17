import { ImageResponse } from "next/og";

import { formatFootballFields, formatHa, formatPercent } from "@/lib/format";
import {
  getClearedByUid,
  getForestById,
  isThreatenedIdParam,
} from "@/lib/forests-server";
import type {
  DeforestedProperties,
  ThreatenedProperties,
} from "@/lib/schema";

/** The TreePine glyph, copied verbatim from `app/icon.svg` so every card
 *  matches the favicon/header mark. Sized by the caller. */
function TreeGlyph({ size, stroke }: { size: number; stroke: string }) {
  // Rotated 90° anticlockwise so the tree lies on its side ("fallen") — the
  // same fallen brand mark the header animates into. Static image: no motion.
  return (
    <div style={{ display: "flex", transform: "rotate(-90deg)" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z" />
        <path d="M12 22v-3" />
      </svg>
    </div>
  );
}

/**
 * Shared social-preview image renderer for `app/opengraph-image.tsx` and
 * `app/twitter-image.tsx`. Both routes need their own static `size` /
 * `contentType` / `alt` exports (Next statically analyzes those per-file), so
 * this only factors out the actual `ImageResponse` render — the tree glyph
 * paths are copied verbatim from `app/icon.svg` / `public/icon.svg` so the
 * card matches the favicon/header mark exactly.
 */
export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
        }}
      >
        {/* Rotated 90° anticlockwise — the "fallen" brand mark (matches the
            header's fall animation; static image, so no motion here). */}
        <div style={{ display: "flex", transform: "rotate(-90deg)" }}>
          <svg
            width="220"
            height="220"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z" />
            <path d="M12 22v-3" />
          </svg>
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 88,
            fontWeight: 700,
            color: "#ffffff",
            display: "flex",
          }}
        >
          deforest.sg
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 36,
            color: "rgba(255,255,255,0.85)",
            display: "flex",
          }}
        >
          Which forests will Singapore lose?
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

/**
 * Per-forest social card for `app/forest/[id]/opengraph-image.tsx` and its
 * `twitter-image.tsx`. Same green identity as the generic card, but the forest
 * is the headline: its name large, then the figures that carry the story — the
 * threatened area (with a football-field comparison), the share of the patch on
 * development-zoned land, and the URA zoning it would become.
 */
export function renderForestOgImage(site: ThreatenedProperties) {
  const area = formatHa(site.area_ha);
  const fields = formatFootballFields(site.area_ha);
  const percent = formatPercent(site.threatened_fraction);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
          color: "#ffffff",
        }}
      >
        {/* Wordmark row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <TreeGlyph size={52} stroke="#ffffff" />
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
            deforest.sg
          </div>
        </div>

        {/* Headline: the forest name */}
        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            maxWidth: 1040,
          }}
        >
          {site.label}
        </div>

        {/* Figures that carry the story */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 600,
              color: "rgba(255,255,255,0.95)",
            }}
          >
            {area} zoned for development · {fields}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              color: "rgba(255,255,255,0.82)",
            }}
          >
            {percent} of this patch · would become {site.dominant_lu_desc}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

/**
 * Resolve a `/forest/[id]` param to its social card — the vulnerable-forest card
 * for a numeric id, the already-cleared card for a UUID, or the generic card if
 * the id is unknown (a stale link) so a preview always renders. Shared by the
 * colocated `opengraph-image.tsx` and `twitter-image.tsx` so the two can't drift.
 */
export async function renderForestParamImage(id: string) {
  if (isThreatenedIdParam(id)) {
    const site = await getForestById(Number(id));
    return site ? renderForestOgImage(site) : renderOgImage();
  }
  const cleared = await getClearedByUid(id);
  return cleared ? renderClearedOgImage(cleared) : renderOgImage();
}

/**
 * Per-forest social card for an *already-cleared* forest (Tengah, Dover East).
 * A muted slate gradient — not the green identity — signals loss rather than
 * risk: the forest is gone. Headlines the name, then the cleared area (with a
 * football-field comparison) and the MP2025 zoning that replaced it.
 */
export function renderClearedOgImage(site: DeforestedProperties) {
  const area = formatHa(site.area_ha);
  const fields = formatFootballFields(site.area_ha);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #3f3f46 0%, #18181b 100%)",
          color: "#ffffff",
        }}
      >
        {/* Wordmark row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <TreeGlyph size={52} stroke="#ffffff" />
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
            deforest.sg
          </div>
        </div>

        {/* Headline: the forest name */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxWidth: 1040,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            Already cleared
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.05,
            }}
          >
            {site.name}
          </div>
        </div>

        {/* Figures that carry the story */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 600,
              color: "rgba(255,255,255,0.95)",
            }}
          >
            {area} cleared for development · {fields}
          </div>
          {site.dominant_lu_desc ? (
            <div
              style={{
                display: "flex",
                fontSize: 30,
                color: "rgba(255,255,255,0.82)",
              }}
            >
              Now zoned {site.dominant_lu_desc}
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
