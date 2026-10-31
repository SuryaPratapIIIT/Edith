import json
import math

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

with open('src/data/calibratedRoadCorridors.json') as f:
    network = json.load(f)

# Origin: Rajiv Chowk [28.445508, 77.033597]
# Dest: Subhash Chowk [28.436000, 77.040000]
orig = [28.445508, 77.033597]
dest = [28.436000, 77.040000]

# Simulate routeViaArterialGraph
# 1. Find nearest corridor
best_orig_c, best_orig_p, min_orig_cte, orig_idx = 'SOHNA_RD', orig, 1e9, 0
best_dest_c, best_dest_p, min_dest_cte, dest_idx = 'SOHNA_RD', dest, 1e9, 0

for c_name, pts in network.items():
    for i in range(len(pts) - 1):
        cte1, snap1, _ = p_to_seg(orig, pts[i], pts[i+1])
        if cte1 < min_orig_cte:
            min_orig_cte = cte1
            best_orig_c = c_name
            best_orig_p = snap1
            orig_idx = i

        cte2, snap2, _ = p_to_seg(dest, pts[i], pts[i+1])
        if cte2 < min_dest_cte:
            min_dest_cte = cte2
            best_dest_c = c_name
            best_dest_p = snap2
            dest_idx = i

print(f"Origin -> corridor: {best_orig_c}, idx: {orig_idx}, CTE: {min_orig_cte:.1f}m")
print(f"Dest   -> corridor: {best_dest_c}, idx: {dest_idx}, CTE: {min_dest_cte:.1f}m")

# If on same corridor:
pts = network[best_orig_c]
route = [orig]
if haversine(orig, best_orig_p) > 5:
    route.append(best_orig_p)

step = 1 if orig_idx <= dest_idx else -1
for i in range(orig_idx, dest_idx, step):
    route.append(pts[i])
route.append(best_dest_p)
if haversine(best_dest_p, dest) > 5:
    route.append(dest)

cum = [0.0]
for i in range(len(route)-1):
    cum.append(cum[-1] + haversine(route[i], route[i+1]))

print(f"Total road distance: {cum[-1]:.1f}m ({cum[-1]/1000:.2f} km)")

# Detect cameras
with open('data/gantries.json') as f:
    gantries = json.load(f)

detected = []
for g in gantries:
    p = [g['lat'], g['lon']]
    best_cte, best_snap, best_dist, best_idx = 1e9, None, 0, 0
    for i in range(len(route)-1):
        cte, snap, t = p_to_seg(p, route[i], route[i+1])
        if cte < best_cte:
            best_cte = cte
            best_snap = snap
            best_idx = i
            best_dist = cum[i] + t * haversine(route[i], route[i+1])
    if best_cte <= 85:
        detected.append({
            'id': g['id'],
            'name': g['name'],
            'dist': round(best_dist),
            'cte': round(best_cte),
            'idx': best_idx,
            'pos': best_snap
        })

detected.sort(key=lambda x: x['dist'])
print(f"Detected {len(detected)} cameras:")
for d in detected:
    print(f"  {d['id']} ({d['name']}): dist={d['dist']}m, idx={d['idx']}, cte={d['cte']}m")

# Check zones
zones = []
for i in range(len(detected) - 1):
    c1 = detected[i]
    c2 = detected[i+1]
    dist = c2['dist'] - c1['dist']
    print(f"Zone Candidate: {c1['name']} -> {c2['name']}, dist = {dist}m")
    if dist >= 150:
        zones.append((c1['name'], c2['name'], dist))

print(f"Total Zones Created: {len(zones)}")

