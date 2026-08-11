/**
 * Land-use colour + aggregation helpers, kept free of React so the map, the
 * compact stats panel, and the site-detail card share one source of truth.
 *
 * Colours are the **official URA Master Plan 2025 zoning fills** (extracted from
 * the URA SPACE legend), keyed on the land-use CLASS — never its rank — so a
 * filter that changes the underlying set never repaints the survivors (dataviz
 * non-negotiable). URA colours aren't CVD-optimized, so identity always rides on
 * the text labels next to each swatch, never colour alone.
 */
import type { ThreatenedProperties } from "@/lib/schema";

/**
 * Every zoning fill in the URA MP2025 legend, keys uppercased to match the
 * data's `LU_DESC`. Complete (not just the classes currently present) so any
 * future class is coloured correctly. URA reuses `#cc0021` across the three
 * institution types; they're distinguished by their text label.
 */
export const LAND_USE_COLOR: Record<string, string> = {
  RESIDENTIAL: "#f6bb81",
  "RESIDENTIAL WITH COMMERCIAL AT 1ST STOREY": "#e78385",
  "COMMERCIAL & RESIDENTIAL": "#36ade5",
  COMMERCIAL: "#215297",
  HOTEL: "#a79cc6",
  WHITE: "#f5f1f2",
  "BUSINESS 1": "#c8a5cf",
  "BUSINESS 1 - WHITE": "#c8a5cf",
  "BUSINESS 2": "#b10166",
  "BUSINESS 2 - WHITE": "#b10166",
  "BUSINESS PARK": "#007fa2",
  "BUSINESS PARK - WHITE": "#007fa2",
  "RESIDENTIAL / INSTITUTION": "#ef9c36",
  "COMMERCIAL / INSTITUTION": "#9ffeff",
  "HEALTH & MEDICAL CARE": "#cc0021",
  "PLACE OF WORSHIP": "#cc0021",
  "CIVIC & COMMUNITY INSTITUTION": "#cc0021",
  "EDUCATIONAL INSTITUTION": "#f4f2c1",
  "OPEN SPACE": "#abb20d",
  PARK: "#00a33a",
  "BEACH AREA": "#f9f7c6",
  "SPORTS & RECREATION": "#a3d49d",
  WATERBODY: "#bedef3",
  ROAD: "#ffffff",
  "TRANSPORT FACILITIES": "#959a9d",
  UTILITY: "#94999c",
  CEMETERY: "#9f8900",
  AGRICULTURE: "#8c875d",
  "PORT / AIRPORT": "#d0d0d0",
  "SPECIAL USE": "#516703",
  "RESERVE SITE": "#fef66d",
};

/** Defensive fallback for any `LU_DESC` not in the legend above. */
export const OTHER_COLOR = "#c9ced1";
export const OTHER_LABEL = "Other";

export function colorForLandUse(luDesc: string): string {
  return LAND_USE_COLOR[luDesc] ?? OTHER_COLOR;
}

/**
 * Plain-language gloss for each URA zoning class — the "what would replace this
 * forest?" explanation shown alongside the code wherever it appears (map popup,
 * site-detail card). Keys match `LAND_USE_COLOR` (uppercased `LU_DESC`). Wording
 * condensed from the official URA Master Plan zoning descriptions. Any class not
 * listed simply shows no gloss (never an error).
 */
export const LAND_USE_DESCRIPTION: Record<string, string> = {
  RESIDENTIAL:
    "Housing — public HDB flats, private condominiums, landed homes and apartments, with supporting local amenities.",
  "RESIDENTIAL WITH COMMERCIAL AT 1ST STOREY":
    "Housing with shops, retail, cafés or services restricted to the ground floor.",
  "COMMERCIAL & RESIDENTIAL":
    "Mixed-use development combining commercial and residential uses across multiple levels.",
  COMMERCIAL:
    "Shopping malls, offices, retail, food & beverage, commercial services, cinemas and entertainment venues.",
  HOTEL:
    "Hotels, boarding houses, serviced apartments and related hospitality facilities.",
  WHITE:
    "High-flexibility sites: developers may mix commercial, hotel, residential, recreational or institutional uses, subject to URA's overall gross-floor-area controls.",
  "BUSINESS 1":
    "Clean and light industry, R&D, technology, software and warehousing that does not generate heavy pollution.",
  "BUSINESS 1 - WHITE":
    "Mostly light industry / R&D (Business 1) integrated with a share of White / commercial uses such as retail, offices and amenities.",
  "BUSINESS 2":
    "Heavier industry — general manufacturing, shipbuilding, chemical processing, workshops and logistics needing buffers or generating more noise, waste or emissions.",
  "BUSINESS 2 - WHITE":
    "Heavy industry (Business 2) integrated with secondary White / commercial uses supporting workers or adjacent operations.",
  "BUSINESS PARK":
    "High-tech industry, advanced R&D, corporate HQs, data centres and knowledge-based businesses in a landscaped setting.",
  "BUSINESS PARK - WHITE":
    "Business Park uses paired with White space for complementary retail, dining, services and hotel / serviced-apartment uses.",
  "RESIDENTIAL / INSTITUTION":
    "Housing integrated with institutional facilities such as homes for the aged, community or religious hubs.",
  "COMMERCIAL / INSTITUTION":
    "Mixed commercial and community / institutional uses — e.g. non-profit HQs, learning centres or community clubs with retail or offices.",
  "HEALTH & MEDICAL CARE":
    "Public and private hospitals, medical centres, polyclinics, nursing homes and specialised medical facilities.",
  "PLACE OF WORSHIP":
    "Religious sites — churches, temples, mosques, gurdwaras and their administrative spaces.",
  "CIVIC & COMMUNITY INSTITUTION":
    "Community centres, libraries, government buildings, police and fire stations, museums and public welfare facilities.",
  "EDUCATIONAL INSTITUTION":
    "Schools, polytechnics, universities, vocational and international schools, and education campuses.",
  "OPEN SPACE":
    "Green buffers, landscaped public open areas and undeveloped urban green lungs.",
  PARK:
    "Public parks, playgrounds, nature parks and green corridors managed for recreation and conservation.",
  "BEACH AREA": "Coastal beaches and immediate seafront recreation areas.",
  "SPORTS & RECREATION":
    "Sports complexes, stadiums, swimming centres, indoor halls, country clubs and golf courses.",
  WATERBODY:
    "Reservoirs, rivers, canals, drainage waterways and open water bodies.",
  ROAD: "Public roads, expressways, interchanges, footpaths and vehicular rights-of-way.",
  "TRANSPORT FACILITIES":
    "MRT/LRT stations, bus interchanges, depots, maintenance yards and transport terminals.",
  UTILITY:
    "Essential infrastructure — electrical substations, water-treatment plants, telecom exchanges and waste-management sites.",
  "PORT / AIRPORT":
    "Sea ports, container terminals, maritime yards, airfields and military or civil airports.",
  AGRICULTURE:
    "Farms, agrotechnology parks, fish farms, nurseries and agricultural research sites.",
  CEMETERY: "Burial grounds, columbaria and memorial parks.",
  "RESERVE SITE":
    "Land earmarked for future development whose specific use is not yet finalised — held in reserve to meet long-term national needs.",
  "SPECIAL USE":
    "Land for specific installations or sensitive uses such as military bases, defence facilities or specialised heavy-industrial compounds.",
};

/** The plain-language gloss for a zoning class, or `undefined` if unmapped. */
export function descriptionForLandUse(luDesc: string): string | undefined {
  return LAND_USE_DESCRIPTION[luDesc];
}

/**
 * A Mapbox `match` expression mapping a land-use property → URA fill, with
 * `OTHER_COLOR` as the fallback. Built from `LAND_USE_COLOR` so the map fill and
 * the JS palette can never drift. Returned as a plain array (no mapbox-gl types)
 * to keep this module React/WebGL-free.
 *
 * `prop` is the feature property to read the class from — `dominant_lu_desc` for
 * the threatened forest layer, `lu_desc` for the raw URA development zones — so
 * both layers colour from the one palette.
 */
export function landUseFillExpression(prop = "dominant_lu_desc"): unknown[] {
  const cases: string[] = [];
  for (const [luDesc, color] of Object.entries(LAND_USE_COLOR)) {
    cases.push(luDesc, color);
  }
  return ["match", ["get", prop], ...cases, OTHER_COLOR];
}

export interface LandUseSlice {
  luDesc: string;
  areaHa: number;
}

/** Sum threatened area by dominant land use, largest first. */
export function aggregateByLandUse(sites: ThreatenedProperties[]): LandUseSlice[] {
  const totals = new Map<string, number>();
  for (const site of sites) {
    totals.set(
      site.dominant_lu_desc,
      (totals.get(site.dominant_lu_desc) ?? 0) + site.area_ha,
    );
  }
  return Array.from(totals.entries())
    .map(([luDesc, areaHa]) => ({ luDesc, areaHa }))
    .sort((a, b) => b.areaHa - a.areaHa);
}

/**
 * Prepares slices for the compact legends. Keeps the top `maxKnown` classes by
 * area and folds everything else — plus any class with no URA colour — into a
 * single trailing "Other" slice, so a 19-class breakdown doesn't balloon the
 * panel. Pass `maxKnown = Infinity` (the default) to keep every coloured class.
 */
export function toColoredSlices(
  byLandUse: LandUseSlice[],
  maxKnown = Infinity,
): LandUseSlice[] {
  const known: LandUseSlice[] = [];
  let otherHa = 0;
  for (const slice of byLandUse) {
    if (slice.luDesc in LAND_USE_COLOR && known.length < maxKnown) {
      known.push(slice);
    } else {
      otherHa += slice.areaHa;
    }
  }
  known.sort((a, b) => b.areaHa - a.areaHa);
  if (otherHa > 0) {
    known.push({ luDesc: OTHER_LABEL, areaHa: otherHa });
  }
  return known;
}
