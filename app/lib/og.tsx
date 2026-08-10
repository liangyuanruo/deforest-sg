import { ImageResponse } from "next/og";

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
        <div
          style={{
            marginTop: 32,
            fontSize: 88,
            fontWeight: 700,
            color: "#ffffff",
            display: "flex",
          }}
        >
          Deforest SG
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 36,
            color: "rgba(255,255,255,0.85)",
            display: "flex",
          }}
        >
          Which forests will Singapore develop?
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
