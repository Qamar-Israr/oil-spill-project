"""
Synthetic AIS dataset for Member 3 development/testing.

No real AIS feed is wired into the repository yet (Member 2's origin
output is also still mocked), so this module produces a deterministic
synthetic AIS record set that exercises the scenarios called out in the
Member 3 spec:

    - vessel close to spill origin
    - vessel far from origin
    - vessel present at the wrong time
    - vessel whose trajectory passes near the origin
    - vessel moving away from the origin
    - vessel with an AIS transmission gap
    - additional vessels for the SIH dashboard demonstration

Each record matches the schema:
    mmsi, vessel_name, timestamp (ISO-8601 str), latitude, longitude,
    speed (knots), heading (degrees), vessel_type

Normal AIS reporting cadence here is 5 minutes (a realistic interval),
matched to the default gap_threshold_minutes (10) in config/ais_config.py
so only genuinely missing pings are flagged as anomalies -- not the
regular reporting interval itself.
"""

from datetime import datetime, timedelta


# Mock spill origin/time used across the demo dataset and tests.
# Matches the shape Member 2's real output is expected to have.
MOCK_ORIGIN = {"latitude": 12.84, "longitude": 74.62}
MOCK_UNCERTAINTY_KM = 3.5
MOCK_SPILL_TIME = "2026-08-20T14:00:00"


def _iso(base: datetime, minutes: int) -> str:
    """Return an ISO-8601 timestamp offset from the base time."""
    return (base + timedelta(minutes=minutes)).isoformat()


def _lerp(a, b, t):
    """Linear interpolation between two values."""
    return a + (b - a) * t


def _vessel_track(
    mmsi,
    name,
    vessel_type,
    waypoints,
    spill_time,
    step_minutes=5,
):
    """
    Build evenly spaced AIS pings by interpolating between waypoints.

    waypoints:
        [(minute_offset, lat, lon, speed, heading), ...]

    AIS records are generated at `step_minutes` intervals.
    """
    records = []

    for i in range(len(waypoints) - 1):
        m0, lat0, lon0, spd0, hdg0 = waypoints[i]
        m1, lat1, lon1, spd1, hdg1 = waypoints[i + 1]

        span = m1 - m0
        steps = max(1, span // step_minutes)

        for s in range(steps + (1 if i == len(waypoints) - 2 else 0)):
            t = s / steps

            minute = m0 + span * t

            records.append(
                {
                    "mmsi": mmsi,
                    "vessel_name": name,
                    "timestamp": _iso(spill_time, minute),
                    "latitude": round(_lerp(lat0, lat1, t), 5),
                    "longitude": round(_lerp(lon0, lon1, t), 5),
                    "speed": round(_lerp(spd0, spd1, t), 1),
                    "heading": round(_lerp(hdg0, hdg1, t), 1),
                    "vessel_type": vessel_type,
                }
            )

    return records


def get_synthetic_ais_dataset() -> list:
    """
    Returns a deterministic synthetic AIS dataset.

    The dataset contains:
        - original Member 3 test scenarios
        - additional SIH demonstration vessels
        - duplicate data for deduplication testing
        - invalid data for preprocessing validation testing
    """

    spill_time = datetime.fromisoformat(MOCK_SPILL_TIME)

    origin_lat = MOCK_ORIGIN["latitude"]
    origin_lon = MOCK_ORIGIN["longitude"]

    records = []

    # ================================================================
    # SCENARIO 1
    # Vessel close to origin shortly before spill.
    # Includes a deliberate AIS transmission gap.
    # ================================================================

    records += _vessel_track(
        "111111111",
        "MV CLOSEWATCH",
        "Tanker",
        waypoints=[
            (
                -30,
                origin_lat + 0.06,
                origin_lon + 0.05,
                12.0,
                220,
            ),
            (
                -10,
                origin_lat + 0.01,
                origin_lon + 0.005,
                11.0,
                230,
            ),
        ],
        spill_time=spill_time,
    )

    # Deliberate 35-minute AIS transmission gap.
    # No pings from -10 minutes to +25 minutes.

    records += _vessel_track(
        "111111111",
        "MV CLOSEWATCH",
        "Tanker",
        waypoints=[
            (
                25,
                origin_lat - 0.02,
                origin_lon - 0.03,
                10.5,
                235,
            ),
            (
                45,
                origin_lat - 0.05,
                origin_lon - 0.06,
                10.0,
                235,
            ),
        ],
        spill_time=spill_time,
    )

    # ================================================================
    # SCENARIO 2
    # Vessel far from origin.
    # ================================================================

    records += _vessel_track(
        "222222222",
        "MV FARAWAY",
        "Cargo",
        waypoints=[
            (
                -30,
                origin_lat + 1.8,
                origin_lon + 1.6,
                14.0,
                90,
            ),
            (
                0,
                origin_lat + 1.75,
                origin_lon + 1.55,
                14.0,
                90,
            ),
            (
                30,
                origin_lat + 1.7,
                origin_lon + 1.5,
                14.0,
                90,
            ),
        ],
        spill_time=spill_time,
    )

    # ================================================================
    # SCENARIO 3
    # Vessel near origin but at the wrong time.
    # ================================================================

    records += _vessel_track(
        "333333333",
        "MV WRONGTIME",
        "Tanker",
        waypoints=[
            (
                -600,
                origin_lat + 0.01,
                origin_lon + 0.01,
                9.0,
                180,
            ),
            (
                -570,
                origin_lat,
                origin_lon,
                9.0,
                180,
            ),
        ],
        spill_time=spill_time,
    )

    # ================================================================
    # SCENARIO 4
    # Vessel trajectory passes near the origin.
    # ================================================================

    records += _vessel_track(
        "444444444",
        "MV PASSTHROUGH",
        "Bulk Carrier",
        waypoints=[
            (
                -20,
                origin_lat + 0.15,
                origin_lon - 0.15,
                16.0,
                300,
            ),
            (
                -5,
                origin_lat + 0.02,
                origin_lon - 0.01,
                16.0,
                300,
            ),
            (
                10,
                origin_lat - 0.10,
                origin_lon + 0.12,
                16.0,
                300,
            ),
        ],
        spill_time=spill_time,
    )

# ================================================================
# SCENARIO 5
# Vessel moving away from origin offshore.
# ================================================================

    records += _vessel_track(
        "555555555",
        "MV DEPARTING",
        "Fishing",
        waypoints=[
            (
                -15,
                origin_lat + 0.01,
                origin_lon - 0.03,
                13.0,
                45,
            ),
            (
                5,
                origin_lat + 0.08,
                origin_lon - 0.10,
                13.5,
                45,
            ),
            (
                25,
                origin_lat + 0.15,
                origin_lon - 0.18,
                14.0,
                45,
            ),
        ],
        spill_time=spill_time,
    )
    # ================================================================
    # ADDITIONAL SIH DEMO CANDIDATES
    #
    # These vessels are placed around the mock origin and spill time.
    # Existing AIS preprocessing/filtering/scoring logic determines
    # whether they qualify and what their scores should be.
    # ================================================================

    # ------------------------------------------------
    # Additional Candidate 1
    # ------------------------------------------------

    records += _vessel_track(
        "777777777",
        "MV OCEAN STAR",
        "Tanker",
        waypoints=[
            (
                -30,
                12.89,
                74.65,
                11.5,
                210,
            ),
            (
                -10,
                12.91,
                74.66,
                11.8,
                215,
            ),
            (
                10,
                12.94,
                74.67,
                12.0,
                220,
            ),
            (
                30,
                12.96,
                74.69,
                12.2,
                225,
            ),
        ],
        spill_time=spill_time,
    )

    # ------------------------------------------------
    # Additional Candidate 2
    # ------------------------------------------------

    records += _vessel_track(
        "888888888",
        "MV BLUE HORIZON",
        "Cargo",
        waypoints=[
            (
                -30,
                12.92,
                74.70,
                13.0,
                280,
            ),
            (
                -10,
                12.93,
                74.69,
                13.0,
                285,
            ),
            (
                10,
                12.95,
                74.68,
                13.2,
                290,
            ),
            (
                30,
                12.97,
                74.67,
                13.5,
                295,
            ),
        ],
        spill_time=spill_time,
    )

    # ------------------------------------------------
    # Additional Candidate 3
    # ------------------------------------------------

    records += _vessel_track(
        "999999999",
        "MV COASTAL TRADER",
        "Bulk Carrier",
        waypoints=[
            (
                -30,
                12.87,
                74.68,
                10.5,
                90,
            ),
            (
                -10,
                12.89,
                74.68,
                10.8,
                90,
            ),
            (
                10,
                12.91,
                74.68,
                11.0,
                90,
            ),
            (
                30,
                12.94,
                74.68,
                11.2,
                90,
            ),
        ],
        spill_time=spill_time,
    )

    # ------------------------------------------------
    # Additional Candidate 4
    # ------------------------------------------------

    records += _vessel_track(
        "101010101",
        "MV SEA FALCON",
        "Fishing",
        waypoints=[
            (
                -30,
                12.95,
                74.64,
                8.5,
                150,
            ),
            (
                -10,
                12.94,
                74.65,
                8.7,
                155,
            ),
            (
                10,
                12.93,
                74.66,
                9.0,
                160,
            ),
            (
                30,
                12.92,
                74.67,
                9.2,
                165,
            ),
        ],
        spill_time=spill_time,
    )

    # ================================================================
    # DUPLICATE RECORD
    #
    # Preprocessing should deduplicate this record.
    # ================================================================

    records.append(dict(records[0]))

    # ================================================================
    # INVALID RECORD
    #
    # Preprocessing should catch this rather than silently accepting it.
    # ================================================================

    records.append(
        {
            "mmsi": "666666666",
            "vessel_name": "MV BADDATA",
            "timestamp": "not-a-timestamp",
            "latitude": 999,
            "longitude": origin_lon,
            "speed": 10.0,
            "heading": 100,
            "vessel_type": "Tanker",
        }
    )

    return records