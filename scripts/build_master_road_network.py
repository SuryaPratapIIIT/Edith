import json
import math
import sys

sys.stdout.reconfigure(encoding='utf-8')

def haversine(p1, p2):
    R = 6371000.0
    la1, lo1 = math.radians(p1[0]), math.radians(p1[1])
    la2, lo2 = math.radians(p2[0]), math.radians(p2[1])
    dlat = la2 - la1
    dlon = lo2 - lo1
    a = math.sin(dlat/2)**2 + math.cos(la1)*math.cos(la2)*math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def densify(pts, max_gap_m=25):
    if len(pts) < 2:
        return pts
    dense = [pts[0]]
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i+1]
        dist = haversine(a, b)
        if dist > max_gap_m:
            steps = math.ceil(dist / max_gap_m)
            for s in range(1, steps):
                frac = s / steps
                dense.append([
                    round(a[0] + frac * (b[0] - a[0]), 6),
                    round(a[1] + frac * (b[1] - a[1]), 6)
                ])
        dense.append(b)
    return dense

def p_to_seg(p, a, b):
    latAvgRad = ((a[0] + b[0]) / 2) * (math.pi / 180)
    cosLat = math.cos(latAvgRad)
    dx = (b[1] - a[1]) * cosLat
    dy = b[0] - a[0]
    segLenSq = dx * dx + dy * dy
    if segLenSq < 1e-12:
        return haversine(p, a), a, 0.0
    ux = (p[1] - a[1]) * cosLat
    uy = p[0] - a[0]
    t = max(0.0, min(1.0, (ux * dx + uy * dy) / segLenSq))
    snapped = [round(a[0] + t * (b[0] - a[0]), 6), round(a[1] + t * (b[1] - a[1]), 6)]
    return haversine(p, snapped), snapped, t

# Load parts
with open('scripts/nh48_pure_southbound_osm.json', 'r', encoding='utf-8') as f:
    nh48_part1 = json.load(f)

with open('scripts/remaining_corridors.json', 'r', encoding='utf-8') as f:
    rem = json.load(f)

with open('scripts/multi_waypoint_corridors.json', 'r', encoding='utf-8') as f:
    multi = json.load(f)

# Combine NH48
nh48_combined = list(nh48_part1) + rem['MANESAR_EXT'][1:]

master_corridors = {
    'NH48_FULL': densify(nh48_combined, 25),
    'GCR_FULL': densify(multi['GCR_FULL'], 25),
    'SOHNA_RD': densify(multi['SOHNA_RD'], 25),
    'MG_ROAD': densify(multi['MG_ROAD'], 25),
    'VIKAS_MARG': densify(multi['VIKAS_MARG'], 25),
    'GCR_EXT_SPR': densify(multi['GCR_EXT_SPR'], 25),
    'NS_MARG': densify(rem['NS_MARG'], 25),
    'OLD_DELHI_RD': densify(rem['OLD_DELHI_RD'], 25),
    'DWARKA_EXPWY': densify(rem['DWARKA_EXPWY'], 25)
}

# Test all 24 gantries
with open('data/gantries.json', 'r', encoding='utf-8') as f:
    gantries = json.load(f)

print("Checking snapping for all 24 gantries:")
matched = 0
for g in gantries:
    p = [g['lat'], g['lon']]
    best_cte = 1e9
    best_corridor = None
    best_snap = None
    for c_name, pts in master_corridors.items():
        for i in range(len(pts) - 1):
            cte, snap, _ = p_to_seg(p, pts[i], pts[i+1])
            if cte < best_cte:
                best_cte = cte
                best_corridor = c_name
                best_snap = snap
    # Allow 85m for wide junction intersections (e.g. Vatika Chowk)
    status = "✓" if best_cte <= 85 else "✗"
    if best_cte <= 85:
        matched += 1
    print(f"  {status} {g['id']} ({g['name']}) -> {best_corridor} CTE={best_cte:.1f}m (snapped {best_snap})")

print(f"\nFinal Matched: {matched} / {len(gantries)}")

# Save to src/data/calibratedRoadCorridors.json
with open('src/data/calibratedRoadCorridors.json', 'w', encoding='utf-8') as f:
    json.dump(master_corridors, f, indent=2)

print("Saved calibrated road corridors to src/data/calibratedRoadCorridors.json!")

