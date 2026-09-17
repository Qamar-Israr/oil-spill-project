from typing import Any, Dict

from config.oil_quantity import (
    OIL_DENSITY_KG_PER_M3,
    OIL_FILM_THICKNESS_MAX_M,
    OIL_FILM_THICKNESS_MIN_M,
)


def estimate_oil_quantity(spill_area_km2: float) -> Dict[str, Any]:
    """Estimate oil quantity from detected area and an assumed thickness range.

    Area is converted from km^2 to m^2, then multiplied by film thickness to
    obtain volume in m^3. Tonnes use the configured oil density. The result is
    explicitly an estimate because this prototype has no thickness measurement.
    """
    area_m2 = max(float(spill_area_km2), 0.0) * 1_000_000.0

    volume_min_m3 = area_m2 * OIL_FILM_THICKNESS_MIN_M
    volume_max_m3 = area_m2 * OIL_FILM_THICKNESS_MAX_M
    tonnes_per_m3 = OIL_DENSITY_KG_PER_M3 / 1_000.0
    quantity_min_tonnes = volume_min_m3 * tonnes_per_m3
    quantity_max_tonnes = volume_max_m3 * tonnes_per_m3
    quantity_estimate_tonnes = (quantity_min_tonnes + quantity_max_tonnes) / 2

    return {
        "is_estimate": True,
        "spill_area_km2": round(float(spill_area_km2), 3),
        "estimated_thickness_m": round(
            (OIL_FILM_THICKNESS_MIN_M + OIL_FILM_THICKNESS_MAX_M) / 2, 9
        ),
        "thickness_range_m": {
            "min": OIL_FILM_THICKNESS_MIN_M,
            "max": OIL_FILM_THICKNESS_MAX_M,
        },
        "thickness_range_microns": {
            "min": round(OIL_FILM_THICKNESS_MIN_M * 1_000_000, 2),
            "max": round(OIL_FILM_THICKNESS_MAX_M * 1_000_000, 2),
        },
        "volume_range_m3": {
            "min": round(volume_min_m3, 3),
            "max": round(volume_max_m3, 3),
        },
        "estimated_quantity_tonnes": round(quantity_estimate_tonnes, 3),
        "quantity_range_tonnes": {
            "min": round(quantity_min_tonnes, 3),
            "max": round(quantity_max_tonnes, 3),
        },
        "oil_density_kg_per_m3": OIL_DENSITY_KG_PER_M3,
        "assumption": (
            "Assumed oil-film thickness range; no satellite-derived thickness "
            "measurement is available in this prototype."
        ),
    }