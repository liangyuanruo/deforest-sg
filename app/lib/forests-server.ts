import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";

import {
  ThreatenedFeatureCollectionSchema,
  type ThreatenedProperties,
} from "@/lib/schema";

/**
 * Server-only access to the threatened-forest properties, read straight from
 * disk at build/request time. The `/forest/[id]` route uses this for
 * `generateStaticParams`, `generateMetadata`, and the per-forest OG image —
 * all of which run on the server, where the client `fetch`-based loaders in
 * `lib/data.ts` don't apply.
 *
 * The file is the same pipeline output the client fetches, synced into
 * `public/data/` by `scripts/sync-results.mjs` before every `dev`/`build`
 * (see the repo's CLAUDE.md), so it is guaranteed present under `process.cwd()`
 * when these functions run. `results/` remains the single source of truth.
 */
const DATA_PATH = join(
  process.cwd(),
  "public",
  "data",
  "threatened_forests.geojson",
);

/** Parse the collection once per server lifetime (React `cache` dedupes across
 *  the page, metadata, and image renders of the same request/build). */
const loadForests = cache(async (): Promise<ThreatenedProperties[]> => {
  const raw = await readFile(DATA_PATH, "utf8");
  const parsed = ThreatenedFeatureCollectionSchema.parse(JSON.parse(raw));
  return parsed.features.map((f) => f.properties);
});

/** Every threatened-forest id, for prerendering `/forest/<id>` at build time. */
export async function getForestIds(): Promise<number[]> {
  const forests = await loadForests();
  return forests.map((f) => f.id);
}

/** The properties for one forest, or `null` if the id isn't a known patch. */
export async function getForestById(
  id: number,
): Promise<ThreatenedProperties | null> {
  if (!Number.isFinite(id)) return null;
  const forests = await loadForests();
  return forests.find((f) => f.id === id) ?? null;
}
