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

query = """
[out:json][timeout:30];
(
  way["highway"~"trunk|primary|secondary"](28.38, 77.02, 28.51, 77.12);
);
out body geom;
"""

url = "https://overpass-api.de/api/interpreter"
req = urllib.request.Request(url, data=query.encode('utf-8'), headers={'User-Agent': 'VeloAiRoadCalibrator/1.0'})

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
        elements = data.get('elements', [])
        print(f"Found {len(elements)} primary/trunk ways in Gurugram.")
        
        saved_ways = []
        for el in elements:
            geom = el.get('geometry', [])
            if len(geom) < 2: continue
            tags = el.get('tags', {})
            name = tags.get('name', tags.get('name:en', tags.get('ref', 'unnamed')))
            saved_ways.append({
                'id': el['id'],
                'name': name,
                'highway': tags.get('highway'),
                'oneway': tags.get('oneway', 'no'),
                'pts': [[round(p['lat'], 6), round(p['lon'], 6)] for p in geom]
            })
            
        with open('scripts/all_gurgaon_arterial_ways.json', 'w', encoding='utf-8') as f:
            json.dump(saved_ways, f, indent=2)
        print(f"Saved {len(saved_ways)} ways to scripts/all_gurgaon_arterial_ways.json")
except Exception as e:
    print("Overpass error:", e)

