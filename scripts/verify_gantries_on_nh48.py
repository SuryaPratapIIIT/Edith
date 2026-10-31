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
        return haversine(p, a), a
    ux = (p[1] - a[1]) * cosLat
    uy = p[0] - a[0]
    t = max(0.0, min(1.0, (ux * dx + uy * dy) / segLenSq))
    snapped = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
    return haversine(p, snapped), snapped

with open('src/data/calibratedRoadCorridors.json', 'r', encoding='utf-8') as f:
    d = json.load(f)
nh48 = d['NH48_FULL']

with open('data/gantries.json', 'r', encoding='utf-8') as f:
    gantries = json.load(f)

for g in gantries:
    if 'NH48' not in g['id']:
        continue
    p = [g['lat'], g['lon']]
    min_d = 1e9
    best_snap = None
    for i in range(len(nh48) - 1):
        cte, snap = p_to_seg(p, nh48[i], nh48[i+1])
        if cte < min_d:
            min_d = cte
            best_snap = snap
    print(f"{g['id']} ({g['name']}): min distance to highway = {min_d:.1f}m, snapped={best_snap}")

