"""Unit tests for the OSM spike-removal pass in ``run_analysis``.

These are pure-geometry tests (no data-file dependency): they build polygons in a
metric CRS (coordinates are metres, as EPSG:3414 areas assume) and assert that
needle spikes are stripped while legitimate geometry — including genuine long
boundary edges and short thin spurs — is left untouched.

The motivating real bug: OSM ``natural=forest`` polygon ``osm_id`` 863261572
("Unnamed forest near Malcolm") carried one vertex ~4 km south of the rest of the
ring, inflating its area by ~3.3 ha and rendering as a long spur on the map.
"""
from __future__ import annotations

import math

from shapely.geometry import MultiPolygon, Point, Polygon

from run_analysis import (
    SPIKE_MAX_RATIO,
    SPIKE_MIN_SPUR_M,
    _despike_ring,
    despike_geometry,
)


def _max_edge_m(poly: Polygon) -> float:
    """Longest exterior edge of a polygon, in coordinate units (metres)."""
    cs = list(poly.exterior.coords)
    return max(math.dist(cs[i], cs[i + 1]) for i in range(len(cs) - 1))


def _base_square() -> Polygon:
    """A plain 300 m square with a couple of extra edge vertices (no spikes)."""
    return Polygon([
        (0, 0), (150, 0), (300, 0),
        (300, 150), (300, 300),
        (150, 300), (0, 300),
        (0, 150), (0, 0),
    ])


# --------------------------------------------------------------------------- #
# Spikes are removed
# --------------------------------------------------------------------------- #
def test_removes_single_vertex_spike_reproducing_the_real_bug():
    # Square body with one vertex flung ~4 km south between two neighbours ~44 m
    # apart — the exact signature of osm_id 863261572.
    body = _base_square()
    cs = list(body.exterior.coords)
    # Insert the spike tip on the bottom edge, between (150,0) and (300,0).
    spiked_coords = cs[:2] + [(225, -4000)] + cs[2:]
    spiked = Polygon(spiked_coords)
    assert _max_edge_m(spiked) > 3000  # the spur is really there

    cleaned = despike_geometry(spiked)

    assert cleaned is not None
    # Tip is gone: no coordinate remains far south, and no giant edge survives.
    assert all(y > -100 for _, y in cleaned.exterior.coords)
    assert _max_edge_m(cleaned) < SPIKE_MIN_SPUR_M
    # Area collapses back to (approximately) the clean square.
    assert math.isclose(cleaned.area, body.area, rel_tol=0.02)


def test_iterates_to_strip_a_stacked_spike():
    # After the deep tip (225, -4000) is removed, the shallow vertex (225, -15) it
    # sat behind is left with two short edges and is correctly kept — exercising the
    # iterate-until-stable loop without trimming a legitimate near-body vertex.
    body = _base_square()
    cs = list(body.exterior.coords)
    stacked = cs[:2] + [(225, -4000), (225, -15)] + cs[2:]
    spiked = Polygon(stacked)

    cleaned = despike_geometry(spiked)

    assert cleaned is not None
    assert min(y for _, y in cleaned.exterior.coords) > -100  # deep tip gone
    assert _max_edge_m(cleaned) < SPIKE_MIN_SPUR_M


def test_removes_spike_from_interior_ring_but_keeps_the_hole():
    exterior = [(0, 0), (1000, 0), (1000, 1000), (0, 1000), (0, 0)]
    # A ~100 m square hole with one vertex flung 3 km away.
    hole = [(400, 400), (500, 400), (450, -2600), (500, 500), (400, 500), (400, 400)]
    poly = Polygon(exterior, [hole])

    cleaned = despike_geometry(poly)

    assert cleaned is not None
    assert len(cleaned.interiors) == 1  # hole survives
    hole_ys = [y for _, y in cleaned.interiors[0].coords]
    assert min(hole_ys) > -100  # but its spike is gone


# --------------------------------------------------------------------------- #
# Legitimate geometry is preserved
# --------------------------------------------------------------------------- #
def test_keeps_large_polygon_with_long_straight_edges():
    # 2 km square: every edge (2000 m) exceeds SPIKE_MIN_SPUR_M, but each corner's
    # neighbours are ~2828 m apart, so the ratio (~1.4) is well under the cap.
    big = Polygon([(0, 0), (2000, 0), (2000, 2000), (0, 2000), (0, 0)])
    cleaned = despike_geometry(big)
    assert cleaned is not None
    assert math.isclose(cleaned.area, big.area, rel_tol=1e-9)
    assert len(cleaned.exterior.coords) == len(big.exterior.coords)


def test_keeps_short_thin_peninsula():
    # A genuine narrow spur only ~200 m long — under SPIKE_MIN_SPUR_M, so kept even
    # though it is thin. Guards against nuking real slivers of forest.
    poly = Polygon([
        (0, 0), (300, 0), (300, 100),
        (160, 100), (150, 300), (140, 100),  # ~200 m tall, ~20 m wide spur
        (0, 100), (0, 0),
    ])
    before = len(poly.exterior.coords)
    cleaned = despike_geometry(poly)
    assert cleaned is not None
    assert len(cleaned.exterior.coords) == before
    assert math.isclose(cleaned.area, poly.area, rel_tol=1e-9)


def test_keeps_plain_square_unchanged():
    body = _base_square()
    cleaned = despike_geometry(body)
    assert cleaned is not None
    assert math.isclose(cleaned.area, body.area, rel_tol=1e-12)
    assert len(cleaned.exterior.coords) == len(body.exterior.coords)


# --------------------------------------------------------------------------- #
# Type handling / edge cases
# --------------------------------------------------------------------------- #
def test_multipolygon_each_part_despiked():
    body = _base_square()
    cs = list(body.exterior.coords)
    spiked = Polygon(cs[:2] + [(225, -4000)] + cs[2:])
    clean_part = Polygon([(500, 500), (600, 500), (600, 600), (500, 600), (500, 500)])
    mp = MultiPolygon([spiked, clean_part])

    cleaned = despike_geometry(mp)

    assert cleaned is not None
    # Whatever the resulting type, nothing should stick out ~4 km south.
    geoms = cleaned.geoms if cleaned.geom_type == "MultiPolygon" else [cleaned]
    for g in geoms:
        assert all(y > -100 for _, y in g.exterior.coords)


def test_non_polygon_and_empty_pass_through():
    pt = Point(1, 2)
    assert despike_geometry(pt) is pt
    empty = Polygon()
    assert despike_geometry(empty) is empty
    assert despike_geometry(None) is None


def test_thresholds_are_the_documented_conservative_values():
    # A regression guard: loosening these silently would risk trimming real geometry.
    assert SPIKE_MIN_SPUR_M == 500.0
    assert SPIKE_MAX_RATIO == 8.0


def test_despike_ring_collapses_to_none_when_too_few_points():
    assert _despike_ring([(0, 0), (1, 1), (0, 0)], SPIKE_MIN_SPUR_M, SPIKE_MAX_RATIO) is None
