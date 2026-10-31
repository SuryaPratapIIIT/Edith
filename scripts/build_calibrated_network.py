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

def main():
    # 1. NH-48 Southbound Motorway (from pure OSM ways)
    with open('scripts/nh48_pure_southbound_osm.json', 'r', encoding='utf-8') as f:
        nh48_raw = json.load(f)
    nh48_dense = densify(nh48_raw, 25)

    # 2. Other arterial corridors (from direct corridor routes)
    with open('scripts/direct_corridor_routes.json', 'r', encoding='utf-8') as f:
        corridors = json.load(f)

    gcr_dense = densify(corridors['GCR'], 25)
    sohna_dense = densify(corridors['SOHNA'], 25)
    mg_dense = densify(corridors['MG'], 25)
    vikas_dense = densify(corridors['VIKAS'], 25)
    spr_dense = densify(corridors['SPR'], 25)

    # 3. Dwarka Expressway (from OSM ways)
    with open('scripts/osm_motorway_ways.json', 'r', encoding='utf-8') as f:
        osm_ways = json.load(f)
    dwarka_way = next((w for w in osm_ways if w['id'] == 1116324313), None)
    dwarka_dense = densify(dwarka_way['pts'], 25) if dwarka_way else []

    calibrated = {
        'NH48_FULL': nh48_dense,
        'GCR_FULL': gcr_dense,
        'SOHNA_RD': sohna_dense,
        'MG_ROAD': mg_dense,
        'VIKAS_MARG': vikas_dense,
        'GCR_EXT_SPR': spr_dense,
        'DWARKA_EXPWY': dwarka_dense
    }

    out_path = 'src/data/calibratedRoadCorridors.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(calibrated, f, indent=2)

    print("Successfully built calibrated road corridors:")
    for k, v in calibrated.items():
        cum = sum(haversine(v[i], v[i+1]) for i in range(len(v)-1))
        print(f"  {k}: {len(v)} points, total length = {cum:.1f}m ({cum/1000:.2f} km)")

if __name__ == '__main__':
    main()

