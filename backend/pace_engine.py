"""
Pace Engine - Core algorithmic math for sectional average speed compliance.
This is the single source of mathematical truth shared between the on-device
React engine (via TypeScript port in paceEngine.ts) and the backend state store.
"""
from typing import Optional


def calculate_pace(
    section_m: float,
    limit_kmh: float,
    elapsed_s: float,
    covered_m: float,
    current_speed_kmh: float,
    margin: float = 0.04,
    amber_gap_kmh: float = 5.0
) -> dict:
    """
    Core prescriptive pace algorithm.

    Parameters
    ----------
    section_m          : Total section length between Gantry 1 and Gantry 2 (meters).
    limit_kmh          : Posted speed limit for this section (km/h).
    elapsed_s          : Seconds elapsed since vehicle crossed Gantry 1.
    covered_m          : Distance covered along the road polyline (meters, snapped via Turf.js).
    current_speed_kmh  : Instantaneous vehicle speed (km/h).
    margin             : Safety margin to absorb GPS/camera clock mismatch (default 4%).
    amber_gap_kmh      : Buffer below ceiling that triggers AMBER alert (default 5 km/h).

    Returns
    -------
    dict with keys: state, ceiling_kmh, alert, remaining_m, need_s,
                    elapsed_s, covered_m, current_avg_kmh, banked_time_s
    """
    # 1. Safety-margined effective speed limit (m/s)
    eff_ms = (limit_kmh * (1.0 - margin)) / 3.6

    # 2. Minimum legal time to traverse the section
    t_min = section_m / eff_ms

    # 3. Remaining distance
    remaining_m = max(section_m - covered_m, 0.0)

    # 4. Current average speed
    current_avg_kmh = round((covered_m / elapsed_s) * 3.6, 1) if elapsed_s > 0 else 0.0

    # 5. Banked time (positive = extra time spent = safe, negative = running too fast)
    ideal_time_s = covered_m / eff_ms if eff_ms > 0 else 0
    banked_time_s = round(elapsed_s - ideal_time_s)

    # Section already completed
    if remaining_m <= 0:
        is_legal = elapsed_s >= t_min
        return {
            "state": "completed",
            "ceiling_kmh": limit_kmh,
            "alert": "green" if is_legal else "red",
            "remaining_m": 0,
            "need_s": 0,
            "elapsed_s": round(elapsed_s),
            "covered_m": round(covered_m),
            "current_avg_kmh": current_avg_kmh,
            "banked_time_s": banked_time_s
        }

    # 6. Time budget remaining for the section
    need_s = t_min - elapsed_s

    # 7. Dynamic ceiling speed (always capped at posted limit)
    if need_s <= 0:
        ceiling = float(limit_kmh)
    else:
        ceiling = min(float(limit_kmh), (remaining_m / need_s) * 3.6)

    # 8. 15-Meter Camera Field of View (FOV) Detection & Spot Speed Enforcement
    fov_radius_m = 15.0
    in_cam1_fov = covered_m <= fov_radius_m
    in_cam2_fov = remaining_m <= fov_radius_m
    in_camera_fov = in_cam1_fov or in_cam2_fov
    camera_name = "Camera 1 Entry" if in_cam1_fov else ("Camera 2 Exit" if in_cam2_fov else None)
    dist_to_camera_m = covered_m if in_cam1_fov else (remaining_m if in_cam2_fov else min(covered_m, remaining_m))
    spot_violation = in_camera_fov and (current_speed_kmh > limit_kmh)

    # 9. Alert classification (Spot speed violation in camera FOV forces immediate RED)
    if spot_violation or current_speed_kmh > ceiling or current_speed_kmh > limit_kmh:
        alert = "red"
    elif current_speed_kmh > (ceiling - amber_gap_kmh):
        alert = "amber"
    else:
        alert = "green"

    return {
        "state": "active",
        "ceiling_kmh": round(ceiling, 1),
        "alert": alert,
        "remaining_m": round(remaining_m),
        "need_s": round(max(need_s, 0)),
        "elapsed_s": round(elapsed_s),
        "covered_m": round(covered_m),
        "current_avg_kmh": current_avg_kmh,
        "banked_time_s": banked_time_s,
        "camera_fov": {
            "in_camera_fov": in_camera_fov,
            "camera_name": camera_name,
            "distance_to_camera_m": round(dist_to_camera_m, 1),
            "spot_violation": spot_violation
        }
    }


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two coordinates in meters."""
    import math
    R = 6371000.0
    to_rad = math.pi / 180
    la1, lo1, la2, lo2 = lat1 * to_rad, lon1 * to_rad, lat2 * to_rad, lon2 * to_rad
    dlat = la2 - la1
    dlon = lo2 - lo1
    a = math.sin(dlat / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))
