import type { z } from "zod";
import {
  DevelopmentZoneFeatureCollectionSchema,
  ForestFeatureCollectionSchema,
  SummarySchema,
  ThreatenedFeatureCollectionSchema,
  type DevelopmentZoneFeatureCollection,
  type ForestFeatureCollection,
  type Summary,
  type ThreatenedFeatureCollection,
} from "@/lib/schema";

/**
 * Options to make the loaders testable without a real network/DOM `fetch`.
 * In the browser these are left at their defaults.
 */
export interface FetchOptions {
  /** Override for the global `fetch`. Defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /** Prefix prepended to the data path, e.g. an origin for SSR/tests. */
  base?: string;
}

async function fetchAndParse<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  options: FetchOptions = {},
): Promise<z.infer<Schema>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${options.base ?? ""}${path}`;

  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  return schema.parse(json);
}

export function fetchThreatened(
  options?: FetchOptions,
): Promise<ThreatenedFeatureCollection> {
  return fetchAndParse(
    "/data/threatened_forests.geojson",
    ThreatenedFeatureCollectionSchema,
    options,
  );
}

export function fetchForestAll(
  options?: FetchOptions,
): Promise<ForestFeatureCollection> {
  return fetchAndParse(
    "/data/forest_all.geojson",
    ForestFeatureCollectionSchema,
    options,
  );
}

export function fetchDevelopmentZones(
  options?: FetchOptions,
): Promise<DevelopmentZoneFeatureCollection> {
  return fetchAndParse(
    "/data/development_zones.geojson",
    DevelopmentZoneFeatureCollectionSchema,
    options,
  );
}

export function fetchSummary(options?: FetchOptions): Promise<Summary> {
  return fetchAndParse("/data/summary.json", SummarySchema, options);
}
