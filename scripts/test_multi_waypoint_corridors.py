import urllib.request
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

# Multi-waypoint queries for each corridor so OSRM stays strictly on the main road
corridors = {
    "GCR_FULL": [
        [28.4789, 77.0939], # Bristol Chowk
        [28.4681, 77.0945], # Khusboo Chowk
        [28.4580, 77.0970], # Sector 27-43 Underpass
        [28.4450, 77.0985], # Genpact Underpass
        [28.4174, 77.0911]  # Rajesh Pilot Chowk
    ],
    "SOHNA_RD": [
        [28.4445, 77.0325], # Rajiv Chowk
        [28.4360, 77.0400], # Subhash Chowk
        [28.4280, 77.0410], # Islampur
        [28.4180, 77.0420], # Sector 48/49
        [28.4022, 77.0435]  # Vatika Chowk (Badshahpur)
    ],
    "MG_ROAD": [
        [28.4722, 77.0645], # IFFCO Chowk
        [28.4795, 77.0805], # MG Road Metro
        [28.4830, 77.0915], # Sikanderpur
        [28.4905, 77.1085]  # Guru Dronacharya Metro
    ],
    "VIKAS_MARG": [
        [28.4519, 77.0419], # Jharsa Chowk
        [28.4398, 77.0465], # Medanta Hospital
        [28.4375, 77.0585], # Bakhtawar Chowk
        [28.4360, 77.0400]  # Subhash Chowk
    ],
    "GCR_EXT_SPR": [
        [28.4174, 77.0911], # Rajesh Pilot Chowk
        [28.4065, 77.0815], # Sector 62 Pioneer
        [28.3980, 77.0710], # Sector 65 Urbana
        [28.4022, 77.0435]  # Vatika Chowk
    ]
}

results = {}
for name, pts in corridors.items():
    loc_str = ";".join(f"{p[1]},{p[0]}" for p in pts)
    url = f"https://router.project-osrm.org/route/v1/driving/{loc_str}?overview=full&geometries=geojson"
    req = urllib.request.Request(url, headers={'User-Agent': 'VeloAiRoadCalibrator/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            r = data['routes'][0]
            coords = [[round(p[1], 6), round(p[0], 6)] for p in r['geometry']['coordinates']]
            dist = r['distance']
            chord = haversine(pts[0], pts[-1])
            detour = (dist / chord - 1) * 100
            print(f"✓ {name}: Dist={dist:.1f}m, Chord={chord:.1f}m (+{detour:.1f}%), Points={len(coords)}")
            results[name] = coords
    except Exception as e:
        print(f"Error on {name}: {e}")

with open('scripts/multi_waypoint_corridors.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2)

