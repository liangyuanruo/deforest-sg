import { z } from "zod";

/**
 * GeoJSON geometry is intentionally NOT deeply validated for performance —
 * Mapbox consumes it directly, and the payloads can contain thousands of
 * polygons/multipolygons. We just pass it through untouched.
 */
const GeometrySchema = z.unknown();

// ---------------------------------------------------------------------------
// threatened_forests.geojson
// ---------------------------------------------------------------------------

export const ThreatenedPropertiesSchema = z.object({
  id: z.number().int(),
  rank: z.number(),
  label: z.string(),
  name: z.string().nullable(),
  locality: z.string().nullable(),
  area_ha: z.number(),
  forest_area_ha: z.number(),
  threatened_fraction: z.number(),
  dominant_lu_desc: z.string(),
  lu_desc_breakdown: z.record(z.string(), z.number()),
  gpr: z.string().nullable(),
  centroid_lon: z.number(),
  centroid_lat: z.number(),
  source_layer: z.string(),
  context: z.string().nullable(),
  wildlife: z.string().nullable(),
  status: z.string().nullable(),
  source: z.string(),
});

export const ThreatenedFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string(), z.number()]).optional(),
  geometry: GeometrySchema,
  properties: ThreatenedPropertiesSchema,
});

export const ThreatenedFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(ThreatenedFeatureSchema),
});

// ---------------------------------------------------------------------------
// forest_all.geojson
// ---------------------------------------------------------------------------

export const ForestPropertiesSchema = z.object({
  id: z.number().int(),
  name: z.string().nullable(),
  forest_area_ha: z.number(),
  source_layer: z.string(),
  source: z.string(),
});

export const ForestFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string(), z.number()]).optional(),
  geometry: GeometrySchema,
  properties: ForestPropertiesSchema,
});

export const ForestFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(ForestFeatureSchema),
});

// ---------------------------------------------------------------------------
// development_zones.geojson
// ---------------------------------------------------------------------------

export const DevelopmentZonePropertiesSchema = z.object({
  id: z.number().int(),
  lu_desc: z.string(),
  gpr: z.string().nullable(),
  area_ha: z.number(),
  source: z.string(),
});

export const DevelopmentZoneFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string(), z.number()]).optional(),
  geometry: GeometrySchema,
  properties: DevelopmentZonePropertiesSchema,
});

export const DevelopmentZoneFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(DevelopmentZoneFeatureSchema),
});

// ---------------------------------------------------------------------------
// deforested.geojson — forest already cleared (Tengah, Dover East), the original
// footprint annotated with the MP2025 zoning that replaced it. `dominant_lu_desc`
// / `gpr` are nullable: a cleared area could fall outside all MP2025 polygons.
// ---------------------------------------------------------------------------

export const DeforestedPropertiesSchema = z.object({
  id: z.number().int(),
  /** Stable UUID (from the curated input's OSM-style `@id`) — the share/deep-link
   *  identifier the app routes on (`/forest/<uid>`), disjoint from the threatened
   *  layer's numeric ids so both can share the one `/forest/[id]` route. */
  uid: z.string(),
  name: z.string(),
  area_ha: z.number(),
  dominant_lu_desc: z.string().nullable(),
  lu_desc_breakdown: z.record(z.string(), z.number()).nullable(),
  gpr: z.string().nullable(),
  centroid_lon: z.number(),
  centroid_lat: z.number(),
  source: z.string(),
});

export const DeforestedFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string(), z.number()]).optional(),
  geometry: GeometrySchema,
  properties: DeforestedPropertiesSchema,
});

export const DeforestedFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(DeforestedFeatureSchema),
});

// ---------------------------------------------------------------------------
// summary.json
// ---------------------------------------------------------------------------

export const TotalsSchema = z.object({
  total_forest_ha_sg: z.number(),
  total_threatened_ha: z.number(),
  threatened_fraction_of_mapped_forest: z.number(),
  n_forest_polygons_sg: z.number(),
  n_threatened_patches: z.number(),
});

export const ByLuDescSchema = z.object({
  lu_desc: z.string(),
  area_ha: z.number(),
  n_fragments: z.number(),
});

export const NamedForestSchema = z.object({
  name: z.string(),
  threatened_ha: z.number(),
});

export const SummarySchema = z.object({
  generated_at: z.string(),
  // Loose/passthrough: only shape we rely on is "it's an object with known
  // keys", but we don't want to break if new provenance fields are added.
  provenance: z.looseObject({}),
  totals: TotalsSchema,
  by_lu_desc: z.array(ByLuDescSchema),
  named_forests_threatened: z.array(NamedForestSchema),
  // Loose objects/arrays: the app treats these as passthrough display data.
  top_sites: z.array(z.looseObject({})),
  methodology: z.looseObject({}),
  validation: z.looseObject({}),
  caveats: z.array(z.string()),
  layers: z.array(z.looseObject({})),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type ThreatenedProperties = z.infer<typeof ThreatenedPropertiesSchema>;
export type ThreatenedFeature = z.infer<typeof ThreatenedFeatureSchema>;
export type ThreatenedFeatureCollection = z.infer<
  typeof ThreatenedFeatureCollectionSchema
>;

export type ForestProperties = z.infer<typeof ForestPropertiesSchema>;
export type ForestFeature = z.infer<typeof ForestFeatureSchema>;
export type ForestFeatureCollection = z.infer<
  typeof ForestFeatureCollectionSchema
>;

export type DevelopmentZoneProperties = z.infer<
  typeof DevelopmentZonePropertiesSchema
>;
export type DevelopmentZoneFeature = z.infer<
  typeof DevelopmentZoneFeatureSchema
>;
export type DevelopmentZoneFeatureCollection = z.infer<
  typeof DevelopmentZoneFeatureCollectionSchema
>;

export type DeforestedProperties = z.infer<typeof DeforestedPropertiesSchema>;
export type DeforestedFeature = z.infer<typeof DeforestedFeatureSchema>;
export type DeforestedFeatureCollection = z.infer<
  typeof DeforestedFeatureCollectionSchema
>;

export type Totals = z.infer<typeof TotalsSchema>;
export type ByLuDesc = z.infer<typeof ByLuDescSchema>;
export type NamedForest = z.infer<typeof NamedForestSchema>;
export type Summary = z.infer<typeof SummarySchema>;
