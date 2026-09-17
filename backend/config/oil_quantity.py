"""Configurable assumptions for prototype oil-quantity estimates."""

import os


def _positive_float(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


# No satellite-derived film thickness is available in this prototype. These
# defaults are assumptions only and can be overridden for a deployment.
OIL_FILM_THICKNESS_MIN_M = _positive_float("OIL_FILM_THICKNESS_MIN_M", 0.000001)
OIL_FILM_THICKNESS_MAX_M = max(
    _positive_float("OIL_FILM_THICKNESS_MAX_M", 0.00001),
    OIL_FILM_THICKNESS_MIN_M,
)
OIL_DENSITY_KG_PER_M3 = _positive_float("OIL_DENSITY_KG_PER_M3", 900.0)