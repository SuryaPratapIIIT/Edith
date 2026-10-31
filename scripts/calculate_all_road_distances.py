import json
import urllib.request
import math
import os

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000.0
    la1, lo1, la2, lo2 = math.radians(lat1), math.radians(lon1), math.radians(lat2), math.radians(lon2)
    dlat = la2 - la1
    dlon = lo2 - lo1
    a = math.sin(dlat/2)**2 + math.cos(la1)*math.cos(la2)*math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def main():
    json_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'gantries.json')
    with open(json_path, 'r', encoding='utf-8') as f:
        gantries = json.load(f)

    print(f"Total gantries in full dataset: {len(gantries)}")
    results = []

    for i in range(len(gantries) - 1):
        g1, g2 = gantries[i], gantries[i+1]
        corridor1 = g1.get('corridor', g1.get('road', ''))
        corridor2 = g2.get('corridor', g2.get('road', ''))
        if corridor1 != corridor2:
            continue

        lat1, lon1 = g1['lat'], g1['lon']
        lat2, lon2 = g2['lat'], g2['lon']
        disp = round(haversine(lat1, lon1, lat2, lon2))

        road_dist = None
        try:
            url = f"https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"
            req = urllib.request.Request(url, headers={'User-Agent': 'VeloAiPaceCoach/1.0'})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                if 'routes' in data and len(data['routes']) > 0:
                    road_dist = round(data['routes'][0]['distance'])
        except Exception as e:
            print(f"OSRM query fallback for {g1['id']} -> {g2['id']}: {e}")

        if road_dist is None:
            road_dist = round(disp * 1.12)

        extra = road_dist - disp
        detour = round(road_dist / disp, 2) if disp > 0 else 1.0

        item = {
            "section_id": f"{g1['id']}_to_{g2['id']}",
            "corridor": corridor1,
            "road": g1.get("road", "Expressway"),
            "name": f"{g1['name']} -> {g2['name']}",
            "start_gantry": g1,
            "end_gantry": g2,
            "displacement_m": disp,
            "road_distance_m": road_dist,
            "curvature_extra_m": extra,
            "detour_factor": detour,
            "limit_kmh": g1.get("limit_kmh", 70)
        }
        results.append(item)
        print(f"[{item['section_id']}] {item['name']}")
        print(f"    Displacement: {disp}m | Road Distance: {road_dist}m (+{extra}m / {detour}x) | Limit: {item['limit_kmh']} km/h")

    out_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'sections_road_distance.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    print(f"\nSuccessfully wrote {len(results)} road-distance sections to {out_path}")

if __name__ == '__main__':
    main()

