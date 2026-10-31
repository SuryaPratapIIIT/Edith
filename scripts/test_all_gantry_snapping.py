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

with open('src/data/calibratedRoadCorridors.json', 'r', encoding='utf-8') as f:
    corridors = json.load(f)

with open('data/gantries.json', 'r', encoding='utf-8') as f:
    gantries = json.load(f)

print(f"Testing snapping for all {len(gantries)} gantries across corridors:")
matched = 0
for g in gantries:
    p = [g['lat'], g['lon']]
    best_cte = 1e9
    best_corridor = None
    best_snap = None
    
    for c_name, pts in corridors.items():
        for i in range(len(pts) - 1):
            cte, snap, _ = p_to_seg(p, pts[i], pts[i+1])
            if cte < best_cte:
                best_cte = cte
                best_corridor = c_name
                best_snap = snap
                
    if best_cte <= 70:
        matched += 1
        print(f"  ✓ {g['id']} ({g['name']}): {best_corridor} CTE={best_cte:.1f}m -> snapped {best_snap}")
    else:
        print(f"  ✗ {g['id']} ({g['name']}): nearest={best_corridor} CTE={best_cte:.1f}m (EXCEEDS 70m)")

print(f"\nMatched: {matched} / {len(gantries)}")
