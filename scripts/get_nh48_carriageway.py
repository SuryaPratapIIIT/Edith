import urllib.request
import json

# Overpass query to find the exact southbound carriageway of NH-48
query = """
[out:json][timeout:15];
(
  way["highway"="motorway"](28.47,77.065,28.505,77.095);
  way["highway"="trunk"](28.47,77.065,28.505,77.095);
);
out body geom;
"""

url = 'https://overpass-api.de/api/interpreter'
req = urllib.request.Request(url, data=query.encode('utf-8'), headers={'User-Agent': 'VeloAiPaceCoach/1.0'})

try:
    with urllib.request.urlopen(req, timeout=15) as res:
        data = json.loads(res.read().decode())
        ways = data.get('elements', [])
        print(f"Found {len(ways)} motorway/trunk ways in NH-48 bounding box.")
        
        # Filter ways with name containing Delhi-Gurugram or NH48 or expressway
        filtered = []
        for w in ways:
            tags = w.get('tags', {})
            name = tags.get('name', tags.get('ref', 'unnamed'))
            geom = w.get('geometry', [])
            if len(geom) >= 2:
                filtered.append({
                    'id': w['id'],
                    'name': name,
                    'tags': tags,
                    'pts': [[round(p['lat'], 6), round(p['lon'], 6)] for p in geom]
                })
        print(f"Filtered {len(filtered)} ways.")
        with open('scripts/nh48_osm_ways.json', 'w', encoding='utf-8') as f:
            json.dump(filtered, f, indent=2)
except Exception as e:
    print("Overpass error:", e)

