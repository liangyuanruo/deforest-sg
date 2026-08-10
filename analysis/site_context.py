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


def context_for_name(name):
    """Return the curated context dict for an OSM name, or None."""
    if not name:
        return None
    for key, val in SITE_CONTEXT.items():
        if key.lower() == str(name).strip().lower():
            return val
    return None
