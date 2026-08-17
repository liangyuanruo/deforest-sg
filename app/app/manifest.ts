import type { MetadataRoute } from "next";

/**
 * Web app manifest — reuses the top-bar identity (the TreePine mark + the
 * "deforest.sg" name) so an installed/added-to-home-screen instance matches the
 * app chrome. The tree icon is `public/icon.svg` (the same glyph as the header),
 * declared both `any` and `maskable` so Android crops it cleanly. `favicon.ico`
 * is the multi-size raster of the same TreePine glyph (16/32/48, generated from
 * `app/icon.svg`) for legacy consumers that can't render SVG.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "deforest.sg",
    short_name: "deforest.sg",
    description:
      "See which Singapore forests are zoned for development under the Master Plan 2025.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16a34a",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
