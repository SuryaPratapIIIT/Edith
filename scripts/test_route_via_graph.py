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
    network = json.load(f)

# Ambience Mall to Rajiv Chowk Underpass
origin = [28.5042, 77.0967]
dest = [28.4455, 77.0336]

# Find nearest corridor and segments
best_corridor = 'NH48_FULL'
pts = network[best_corridor]

min_orig_cte, best_orig_snap, orig_idx = 1e9, origin, 0
for i in range(len(pts) - 1):
    cte, snap, _ = p_to_seg(origin, pts[i], pts[i+1])
    if cte < min_orig_cte:
        min_orig_cte = cte
        best_orig_snap = snap
        orig_idx = i

min_dest_cte, best_dest_snap, dest_idx = 1e9, dest, 0
for i in range(len(pts) - 1):
    cte, snap, _ = p_to_seg(dest, pts[i], pts[i+1])
    if cte < min_dest_cte:
        min_dest_cte = cte
        best_dest_snap = snap
        dest_idx = i

print(f"Origin snapped at index {orig_idx} (CTE {min_orig_cte:.1f}m): {best_orig_snap}")
print(f"Dest snapped at index {dest_idx} (CTE {min_dest_cte:.1f}m): {best_dest_snap}")

# Build route slice
route = [origin]
if haversine(origin, best_orig_snap) > 5:
    route.append(best_orig_snap)

for i in range(orig_idx + 1, dest_idx + 1):
    route.append(pts[i])

route.append(best_dest_snap)
if haversine(best_dest_snap, dest) > 5:
    route.append(dest)

total_dist = sum(haversine(route[i], route[i+1]) for i in range(len(route)-1))
disp = haversine(origin, dest)
print(f"Route Points: {len(route)}")
print(f"Strict Road Distance: {total_dist:.1f} m ({total_dist/1000:.2f} km)")
print(f"Displacement (Chord): {disp:.1f} m ({disp/1000:.2f} km)")
print(f"Detour: +{((total_dist/disp - 1)*100):.1f}%")

# Check for Sector 15-I intrusion
sec15_pts = [p for p in route if 28.448 < p[0] < 28.452 and 77.038 < p[1] < 77.040]
print(f"Points in Sector 15-I: {len(sec15_pts)}")

# Check for Sector 25A intrusion
sec25_pts = [p for p in route if 28.478 < p[0] < 28.500 and p[1] > 77.088]
print(f"Points in Sector 25A (lon > 77.088): {len(sec25_pts)}")

