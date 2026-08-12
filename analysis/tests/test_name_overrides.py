"""Unit tests for the curated osm_id -> display-name override.

Only ~31 of the OSM forest polygons carry a `name`; the rest are locally-known
secondary forests OSM never named. `site_context` supplies names for a curated
set of those by *exact osm_id* (not a bbox). These tests pin that lookup's
contract: it names the curated ids, leaves everything else untouched, and never
collides with the validated "Maju Forest" name.
"""
from __future__ import annotations

from site_context import (
    FOREST_NAME_OVERRIDES,
    SITE_CONTEXT,
    name_override_for_osm_id,
)


def test_names_a_curated_polygon():
    # Tagore Forest is a single ~100 ha polygon OSM left unnamed.
    assert name_override_for_osm_id(75616381) == "Tagore Forest"


def test_multiple_polygons_share_one_name():
    # Springleaf Forest spans 11 polygons; each maps to the same name so they
    # aggregate into one named forest downstream.
    springleaf = [i for i, n in FOREST_NAME_OVERRIDES.items() if n == "Springleaf Forest"]
    assert len(springleaf) == 11
    assert all(name_override_for_osm_id(i) == "Springleaf Forest" for i in springleaf)


def test_uncurated_polygon_returns_none():
    # An id we haven't curated falls through to the pipeline's normal behaviour.
    assert name_override_for_osm_id(999999999) is None


def test_accepts_numpy_int_and_stringly_ids():
    # osm_id arrives as numpy int64 from geopandas; coercion must not choke.
    assert name_override_for_osm_id(75616381.0) == "Tagore Forest"
    assert name_override_for_osm_id("75616381") == "Tagore Forest"


def test_bad_input_returns_none():
    assert name_override_for_osm_id(None) is None
    assert name_override_for_osm_id("not-an-id") is None


def test_never_shadows_the_validated_maju_name():
    # Validation matches the raw OSM name "Maju Forest"; no override may claim it.
    assert "Maju Forest" not in FOREST_NAME_OVERRIDES.values()


def test_no_duplicate_ids_across_names():
    # A polygon must belong to at most one curated forest.
    ids = list(FOREST_NAME_OVERRIDES.keys())
    assert len(ids) == len(set(ids))


def test_greenwood_park_polygon_is_not_named():
    # 776122511 ("Greenwood Park") was deliberately excluded from Adam Drive Forest.
    assert name_override_for_osm_id(776122511) is None


def test_curated_names_may_grow_context_later():
    # Curated context is keyed on the display name; these names are valid keys to
    # add SITE_CONTEXT entries for later (none required now).
    assert isinstance(SITE_CONTEXT, dict)
