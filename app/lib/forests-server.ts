import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";

import {
  DeforestedFeatureCollectionSchema,
  ThreatenedFeatureCollectionSchema,
  type DeforestedProperties,
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
const dataPath = (file: string) => join(process.cwd(), "public", "data", file);

/** Parse the collection once per server lifetime (React `cache` dedupes across
 *  the page, metadata, and image renders of the same request/build). */
const loadForests = cache(async (): Promise<ThreatenedProperties[]> => {
  const raw = await readFile(dataPath("threatened_forests.geojson"), "utf8");
  const parsed = ThreatenedFeatureCollectionSchema.parse(JSON.parse(raw));
  return parsed.features.map((f) => f.properties);
});

const loadCleared = cache(async (): Promise<DeforestedProperties[]> => {
  const raw = await readFile(dataPath("deforested.geojson"), "utf8");
  const parsed = DeforestedFeatureCollectionSchema.parse(JSON.parse(raw));
  return parsed.features.map((f) => f.properties);
});

/** Every threatened-forest id, for prerendering `/forest/<id>` at build time. */
export async function getForestIds(): Promise<number[]> {
  const forests = await loadForests();
  return forests.map((f) => f.id);
}

/**
 * Every `/forest/<id>` param to prerender — the threatened patches' numeric ids
 * plus the already-cleared forests' UUIDs, all as strings. Both id families share
 * the one dynamic route (numeric vs UUID never collide).
 */
export async function getForestPathIds(): Promise<string[]> {
  const [forests, cleared] = await Promise.all([loadForests(), loadCleared()]);
  return [...forests.map((f) => String(f.id)), ...cleared.map((f) => f.uid)];
}

/** The properties for one threatened forest, or `null` if the numeric id isn't a
 *  known patch. */
export async function getForestById(
  id: number,
): Promise<ThreatenedProperties | null> {
  if (!Number.isFinite(id)) return null;
  const forests = await loadForests();
  return forests.find((f) => f.id === id) ?? null;
}

/** The properties for one already-cleared forest by its UUID, or `null`. */
export async function getClearedByUid(
  uid: string,
): Promise<DeforestedProperties | null> {
  const cleared = await loadCleared();
  return cleared.find((f) => f.uid === uid) ?? null;
}

/** True when a `/forest/[id]` param is a threatened patch's numeric id (digits
 *  only); a UUID (with hyphens/letters) is an already-cleared forest. Used by the
 *  route to pick which lookup + render path to take. */
export function isThreatenedIdParam(id: string): boolean {
  return /^\d+$/.test(id);
}
