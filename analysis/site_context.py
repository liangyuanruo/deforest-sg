"""
Curated, human-maintained context for named forest/greenery sites.

This is deliberately separate from the analysis code so it can be edited without
touching the pipeline. Keys are matched case-insensitively against the OSM `name`
attribute of forest polygons. Keep statements factual and modest; where a claim is
uncertain, keep it general. `context` is displayed as background in the app.

Fields:
  context   : short human-readable background (history, why it's notable)
  wildlife  : notable biodiversity associated with the site (if known)
  status    : short label for how imminent/formal the development plan is
"""

SITE_CONTEXT = {
    "Maju Forest": {
        "context": (
            "Secondary forest near the former Maju Camp (Clementi / Ulu Pandan area). "
            "Named by MND alongside Gillman Barracks (Aug 2026) as a site that will need "
            "to be developed to meet housing needs over the next decade."
        ),
        "wildlife": "Secondary-forest fauna; part of a green corridor linking Clementi/Ulu Pandan patches.",
        "status": "Flagged for development within the next decade (MND, 2026).",
    },
    "Dover Forest West": {
        "context": (
            "Western half of Dover Forest at Ulu Pandan. After a 2021 review, Dover Forest "
            "East was released for HDB flats while the West was deferred for further study "
            "and phased development."
        ),
        "wildlife": "Sunda pangolin, grey-headed fish eagle and straw-headed bulbul have been recorded in the wider Dover/Ulu Pandan area.",
        "status": "Deferred/phased after 2021 review; remains zoned for eventual development.",
    },
    "Dover Forest East": {
        "context": "Eastern half of Dover Forest, released for public housing (Ulu Pandan BTO) after the 2021 review.",
        "wildlife": "Recorded secondary-forest birds and mammals prior to clearance.",
        "status": "Released for housing.",
    },
    "Clementi Forest": {
        "context": (
            "Large regenerated secondary forest along the former Jurong–Kranji railway "
            "corridor. Popular with nature groups; retained as reserve land under study."
        ),
        "wildlife": "Rich secondary-forest bird and butterfly diversity along the old rail corridor.",
        "status": "Reserve land; long-term intentions under study.",
    },
    "Toh Tuck Forest": {
        "context": "Secondary forest patch in the Toh Tuck / Bukit Batok area, on land held in reserve.",
        "wildlife": "Secondary-forest fauna typical of the Bukit Batok green belt.",
        "status": "Reserve/development-zoned.",
    },
    "Kampong Teban Forest": {
        "context": "Secondary forest in the Teban / Jurong area of western Singapore.",
        "wildlife": None,
        "status": "Development-zoned.",
    },
    "Lorong Banir Forest": {
        "context": "Secondary forest patch; part of the western/central green fragments.",
        "wildlife": None,
        "status": "Development-zoned.",
    },
    "Lorong Halus": {
        "context": (
            "Former landfill site at the north-eastern coast, now regenerated wetland/woodland "
            "near Lorong Halus Wetland and the Serangoon Reservoir."
        ),
        "wildlife": "Coastal/wetland edge habitat; birdlife associated with Serangoon Reservoir.",
        "status": "Mixed reserve/development-zoned.",
    },
    "Bukit Batok Hillside Park": {
        "context": "Wooded hillside in Bukit Batok, adjacent to residential development.",
        "wildlife": None,
        "status": "Partly park, partly development-zoned.",
    },
    "Kuala Loyang (Old Tampines Road) Forest": {
        "context": "Secondary forest along the Old Tampines Road / Loyang area in the north-east.",
        "wildlife": None,
        "status": "Development-zoned.",
    },
}

# NOTE: we intentionally have no location/bounding-box ("AOI") mechanism here.
# An earlier version relabelled any unnamed forest sliver inside a lon/lat box as
# "Gillman Barracks" for validation. That was dropped as unprincipled: the box
# aligns to nothing on the ground, mislabels neighbouring patches of the same
# forest, and — since Gillman Barracks is mostly redevelopment of the historic
# barracks rather than forest clearance — let the method claim a "recovery" it
# hadn't earned. Context now comes only from a matched OSM forest name (above),
# and validation rests solely on Maju Forest (see run_analysis.validate()).


# --------------------------------------------------------------------------- #
# Curated display names for forest polygons OSM never named
# --------------------------------------------------------------------------- #
# Only ~31 of the ~1,142 OSM forest polygons carry a `name` tag; the rest fall
# back to "Unnamed forest near <locality>". These are locally-known secondary
# forests whose names are absent from OSM. We supply them by *exact OSM polygon
# id* — NOT a lon/lat bounding box. This is deliberately distinct from the AOI
# mechanism removed above: each entry names one specific, traced polygon, so it
# cannot align to "nothing on the ground" or mislabel a neighbouring sliver.
#
# These are DISPLAY names only. They flow into the site label, the curated-context
# lookup, and the summary's per-name aggregation — but never into the validation
# gate, which matches the raw OSM name "Maju Forest" and is untouched by this map.
#
# Caveat: osm_ids are stable only against the pinned BBBike extract in `data/`
# (treated read-only). If that extract is ever refreshed, re-verify these ids.
#
# Grouped by name for maintainability (a name may span several polygons of the
# same forest); flattened to an id->name lookup below.
_FOREST_NAME_TO_OSM_IDS = {
    "Tagore Forest": [75616381],
    "Springleaf Forest": [
        680527348, 680527349, 619378326, 619378324, 1093321097, 1093321098,
        619378330, 980618578, 1173836902, 680527358, 1075462623,
    ],
    "Ulu Sembawang Forest": [
        524447046, 464555230, 1078245454, 1057469625, 1057469626, 1078245455,
        1078245449, 1222921110, 1222921111, 1057469624,
    ],
    "Bukit Brown Forest": [1240432144, 1047180051],
    "Bahar Forest": [770798484],
    "Loyang Mangroves": [213598449],
    # Adam Drive Forest spans the "The Greenwood" + "Adam Park" clusters. The
    # separate "Greenwood Park" polygon (776122511) is deliberately excluded.
    "Adam Drive Forest": [
        272603712, 1060097009,  # The Greenwood
        1240744017, 1050510490, 1140702124, 1050510489, 1140702125,
        906081519, 906081518, 1151541365, 1151541368, 1482715163,  # Adam Park
    ],
    # The whole "near Queensway" cluster. The strict Alexandra Woodland extent is
    # only the part north of the AYE / south-east of Portsdown Ave, but these six
    # polygons sit in one tight cluster and splitting mid-polygon by a road line
    # would reintroduce the bbox logic removed above, so we name the cluster whole.
    "Alexandra Woodland": [
        1147843840, 912363338, 1228247575, 1148718866, 1148718871, 1148718867,
    ],
}

FOREST_NAME_OVERRIDES = {
    osm_id: name
    for name, ids in _FOREST_NAME_TO_OSM_IDS.items()
    for osm_id in ids
}


def context_for_name(name):
    """Return the curated context dict for an OSM name, or None."""
    if not name:
        return None
    for key, val in SITE_CONTEXT.items():
        if key.lower() == str(name).strip().lower():
            return val
    return None


def name_override_for_osm_id(osm_id):
    """Curated display name for a forest polygon OSM never named, or None.

    Keyed on the exact OSM polygon id (see FOREST_NAME_OVERRIDES). Returns None
    for any polygon we haven't curated, leaving the pipeline's normal
    name-or-"Unnamed near <locality>" behaviour intact.
    """
    if osm_id is None:
        return None
    try:
        return FOREST_NAME_OVERRIDES.get(int(osm_id))
    except (TypeError, ValueError):
        return None
