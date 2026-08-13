import { describe, expect, it } from "vitest";
import {
  DeforestedFeatureCollectionSchema,
  DevelopmentZoneFeatureCollectionSchema,
  ForestFeatureCollectionSchema,
  SummarySchema,
  ThreatenedFeatureCollectionSchema,
} from "@/lib/schema";

describe("ThreatenedFeatureCollectionSchema", () => {
  const validFixture = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [] },
        properties: {
          id: 572796250,
          rank: 1,
          label: "Unnamed forest near Simpang",
          name: null,
          locality: "Simpang",
          area_ha: 281.5937,
          forest_area_ha: 288.9215,
          threatened_fraction: 0.9746,
          dominant_lu_desc: "RESERVE SITE",
          lu_desc_breakdown: { "RESERVE SITE": 280.8785, ROAD: 0.7153 },
          gpr: "EVA",
          centroid_lon: 103.840606,
          centroid_lat: 1.447818,
          source_layer: "natural",
          context: null,
          wildlife: null,
          status: null,
          source: "OSM_forest ∩ URA_MP2025",
        },
      },
    ],
  };

  it("parses a valid fixture", () => {
    const parsed = ThreatenedFeatureCollectionSchema.parse(validFixture);
    expect(parsed.type).toBe("FeatureCollection");
    expect(parsed.features).toHaveLength(1);
    const props = parsed.features[0].properties;
    expect(props.id).toBe(572796250);
    expect(props.name).toBeNull();
    expect(props.locality).toBe("Simpang");
    expect(props.lu_desc_breakdown).toEqual({
      "RESERVE SITE": 280.8785,
      ROAD: 0.7153,
    });
    expect(props.gpr).toBe("EVA");
  });

  it("throws when area_ha is not a number", () => {
    const bad = {
      ...validFixture,
      features: [
        {
          ...validFixture.features[0],
          properties: {
            ...validFixture.features[0].properties,
            area_ha: "281.5937",
          },
        },
      ],
    };
    expect(() => ThreatenedFeatureCollectionSchema.parse(bad)).toThrow();
  });

  it("throws when a required property is missing", () => {
    const propertiesWithoutRank: Record<string, unknown> = {
      ...validFixture.features[0].properties,
    };
    delete propertiesWithoutRank.rank;
    const bad = {
      ...validFixture,
      features: [
        {
          ...validFixture.features[0],
          properties: propertiesWithoutRank,
        },
      ],
    };
    expect(() => ThreatenedFeatureCollectionSchema.parse(bad)).toThrow();
  });
});

describe("ForestFeatureCollectionSchema", () => {
  const validFixture = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [] },
        properties: {
          id: 20566008,
          name: null,
          forest_area_ha: 0.14212688805007853,
          source_layer: "natural",
          source: "OSM",
        },
      },
    ],
  };

  it("parses a valid fixture", () => {
    const parsed = ForestFeatureCollectionSchema.parse(validFixture);
    expect(parsed.features[0].properties.name).toBeNull();
    expect(parsed.features[0].properties.forest_area_ha).toBeCloseTo(
      0.14212688805007853,
    );
  });

  it("throws when forest_area_ha is missing", () => {
    const bad = {
      ...validFixture,
      features: [
        {
          ...validFixture.features[0],
          properties: {
            id: 20566008,
            name: null,
            source_layer: "natural",
            source: "OSM",
          },
        },
      ],
    };
    expect(() => ForestFeatureCollectionSchema.parse(bad)).toThrow();
  });
});

describe("DevelopmentZoneFeatureCollectionSchema", () => {
  const validFixture = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [] },
        properties: {
          id: 692567,
          lu_desc: "RESIDENTIAL",
          gpr: "2.5",
          area_ha: 3.2024,
          source: "URA_MP2025",
        },
      },
    ],
  };

  it("parses a valid fixture, including nullable gpr", () => {
    const withNullGpr = {
      ...validFixture,
      features: [
        {
          ...validFixture.features[0],
          properties: { ...validFixture.features[0].properties, gpr: null },
        },
      ],
    };
    const parsed =
      DevelopmentZoneFeatureCollectionSchema.parse(withNullGpr);
    expect(parsed.features[0].properties.gpr).toBeNull();
    expect(parsed.features[0].properties.lu_desc).toBe("RESIDENTIAL");
  });

  it("throws when lu_desc is missing", () => {
    const bad = {
      ...validFixture,
      features: [
        {
          ...validFixture.features[0],
          properties: {
            id: 692567,
            gpr: "2.5",
            area_ha: 3.2024,
            source: "URA_MP2025",
          },
        },
      ],
    };
    expect(() =>
      DevelopmentZoneFeatureCollectionSchema.parse(bad),
    ).toThrow();
  });
});

describe("DeforestedFeatureCollectionSchema", () => {
  // Mirrors results/deforested.geojson (Dover Forest East): the original cleared
  // footprint annotated with the MP2025 zoning that replaced it.
  const validFixture = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [] },
        properties: {
          id: 0,
          uid: "8cbcd280-96e8-11f1-9962-e3c92fbd79cc",
          name: "Dover Forest East",
          area_ha: 8.6631,
          dominant_lu_desc: "RESIDENTIAL",
          lu_desc_breakdown: { RESIDENTIAL: 5.097, PARK: 0.3515 },
          gpr: "3.4, 3.6, EVA, SDP",
          centroid_lon: 103.780432,
          centroid_lat: 1.311702,
          source: "curated ∩ URA_MP2025",
        },
      },
    ],
  };

  it("parses a valid fixture", () => {
    const parsed = DeforestedFeatureCollectionSchema.parse(validFixture);
    const props = parsed.features[0].properties;
    expect(props.uid).toBe("8cbcd280-96e8-11f1-9962-e3c92fbd79cc");
    expect(props.name).toBe("Dover Forest East");
    expect(props.area_ha).toBeCloseTo(8.6631);
    expect(props.dominant_lu_desc).toBe("RESIDENTIAL");
    expect(props.gpr).toBe("3.4, 3.6, EVA, SDP");
  });

  it("allows null zoning (a cleared area outside all MP2025 polygons)", () => {
    const withNullZoning = {
      ...validFixture,
      features: [
        {
          ...validFixture.features[0],
          properties: {
            ...validFixture.features[0].properties,
            dominant_lu_desc: null,
            lu_desc_breakdown: null,
            gpr: null,
          },
        },
      ],
    };
    const parsed = DeforestedFeatureCollectionSchema.parse(withNullZoning);
    expect(parsed.features[0].properties.dominant_lu_desc).toBeNull();
    expect(parsed.features[0].properties.gpr).toBeNull();
  });

  it("throws when the required name is missing", () => {
    const bad = {
      ...validFixture,
      features: [
        {
          ...validFixture.features[0],
          properties: {
            id: 0,
            uid: "8cbcd280-96e8-11f1-9962-e3c92fbd79cc",
            area_ha: 8.6631,
            dominant_lu_desc: "RESIDENTIAL",
            lu_desc_breakdown: { RESIDENTIAL: 5.097 },
            gpr: "3.4",
            centroid_lon: 103.780432,
            centroid_lat: 1.311702,
            source: "curated ∩ URA_MP2025",
          },
        },
      ],
    };
    expect(() => DeforestedFeatureCollectionSchema.parse(bad)).toThrow();
  });
});

describe("SummarySchema", () => {
  const validFixture = {
    generated_at: "2026-08-10T07:20:47.235156+00:00",
    provenance: {
      masterplan: "MP2025",
      masterplan_url: "https://example.com",
      forest_source: "OSM",
      forest_source_url: "https://example.com",
      area_crs: "EPSG:3414",
      export_crs: "EPSG:4326",
    },
    totals: {
      total_forest_ha_sg: 5006.7,
      total_threatened_ha: 2940.9,
      threatened_fraction_of_mapped_forest: 0.587,
      n_forest_polygons_sg: 831,
      n_threatened_patches: 624,
    },
    by_lu_desc: [
      { lu_desc: "RESERVE SITE", area_ha: 1514.16, n_fragments: 173 },
      { lu_desc: "RESIDENTIAL", area_ha: 514.21, n_fragments: 578 },
    ],
    named_forests_threatened: [
      { name: "Kampong Teban Forest", threatened_ha: 71.72 },
      { name: "Toh Tuck Forest", threatened_ha: 56.26 },
    ],
    top_sites: [{ rank: 1, label: "Unnamed forest near Simpang" }],
    methodology: { summary: "..." },
    validation: { overall_pass: true, sites: [] },
    caveats: ["OSM crowd-sourced canopy is not an authoritative survey."],
    layers: [
      {
        file: "threatened_forests.geojson",
        source: "OSM_forest ∩ URA_MP2025",
        geometry: "Polygon",
        role: "intersection result",
        features: 624,
      },
    ],
  };

  it("parses a minimal valid summary", () => {
    const parsed = SummarySchema.parse(validFixture);
    expect(parsed.totals.total_forest_ha_sg).toBe(5006.7);
    expect(parsed.totals.n_threatened_patches).toBe(624);
    expect(parsed.by_lu_desc).toHaveLength(2);
    expect(parsed.by_lu_desc[0]).toEqual({
      lu_desc: "RESERVE SITE",
      area_ha: 1514.16,
      n_fragments: 173,
    });
    expect(parsed.named_forests_threatened[0].name).toBe(
      "Kampong Teban Forest",
    );
  });

  it("keeps unknown keys on passthrough sections", () => {
    const withExtra = {
      ...validFixture,
      provenance: { ...validFixture.provenance, unexpected_field: "keep" },
    };
    const parsed = SummarySchema.parse(withExtra);
    expect(
      (parsed.provenance as Record<string, unknown>).unexpected_field,
    ).toBe("keep");
  });

  it("throws when totals is missing a required field", () => {
    const bad = {
      ...validFixture,
      totals: {
        total_forest_ha_sg: 5006.7,
        total_threatened_ha: 2940.9,
        threatened_fraction_of_mapped_forest: 0.587,
        n_forest_polygons_sg: 831,
        // n_threatened_patches missing
      },
    };
    expect(() => SummarySchema.parse(bad)).toThrow();
  });
});
