import urllib.request
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

corridors = {
    # Golf Course Road: From Bristol Chowk / Sikanderpur down to Rajesh Pilot Chowk / Sector 56
    "GCR": {
        "start": [28.4789, 77.0939], # Bristol Chowk
        "end": [28.4174, 77.0911]    # Rajesh Pilot Chowk
    },
    # Sohna Road: From Rajiv Chowk down to Vatika Chowk (Badshahpur)
    "SOHNA": {
        "start": [28.4445, 77.0325], # Rajiv Chowk
        "end": [28.4022, 77.0435]    # Vatika Chowk
    },
    # MG Road: From IFFCO Chowk to Guru Dronacharya Metro / Mehrauli Border
    "MG": {
        "start": [28.4722, 77.0645], # IFFCO Chowk
        "end": [28.4905, 77.1085]    # Guru Dronacharya Metro
    },
    # Vikas Marg: Jharsa Chowk to Subhash Chowk via Bakhtawar Chowk
    "VIKAS": {
        "start": [28.4519, 77.0419], # Jharsa Chowk
        "end": [28.4360, 77.0400]    # Subhash Chowk
    },
    # Golf Course Extension / SPR: Rajesh Pilot Chowk to Vatika Chowk
    "SPR": {
        "start": [28.4174, 77.0911], # Rajesh Pilot Chowk
        "end": [28.4022, 77.0435]    # Vatika Chowk
    }
}

results = {}
for name, c in corridors.items():
    lat1, lon1 = c['start']
    lat2, lon2 = c['end']
    url = f"https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson"
    req = urllib.request.Request(url, headers={'User-Agent': 'VeloAiRoadCalibrator/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            r = data['routes'][0]
            coords = [[round(p[1], 6), round(p[0], 6)] for p in r['geometry']['coordinates']]
            dist = r['distance']
            chord = haversine(c['start'], c['end'])
            detour = (dist / chord - 1) * 100
            print(f"{name}: Dist={dist:.1f}m, Chord={chord:.1f}m (+{detour:.1f}%), Points={len(coords)}")
            results[name] = coords
    except Exception as e:
        print(f"Error on {name}: {e}")

with open('scripts/direct_corridor_routes.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2)

