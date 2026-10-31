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
  way["highway"="motorway"]["oneway"="yes"](28.43, 77.00, 28.51, 77.10);
);
out body geom;
"""

url = "https://overpass-api.de/api/interpreter"
req = urllib.request.Request(url, data=query.encode('utf-8'), headers={'User-Agent': 'VeloAiRoadCalibrator/1.0'})

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
        elements = data.get('elements', [])
        print(f"Found {len(elements)} motorway ways.")
        
        # Filter for southbound carriageway (traveling from NE 28.50, 77.09 to SW 28.44, 77.03)
        southbound_ways = []
        for el in elements:
            geom = el.get('geometry', [])
            if len(geom) < 2: continue
            first_pt = [geom[0]['lat'], geom[0]['lon']]
            last_pt = [geom[-1]['lat'], geom[-1]['lon']]
            # In southbound carriageway, lat generally decreases or travels SW
            d_lat = last_pt[0] - first_pt[0]
            d_lon = last_pt[1] - first_pt[1]
            tags = el.get('tags', {})
            name = tags.get('name', tags.get('name:en', ''))
            ref = tags.get('ref', '')
            
            # Print info
            print(f"Way {el['id']} ({name} / {ref}): len={len(geom)}, start={first_pt}, end={last_pt}, d_lat={d_lat:.4f}, d_lon={d_lon:.4f}")
            southbound_ways.append({
                'id': el['id'],
                'name': name,
                'ref': ref,
                'pts': [[round(p['lat'], 6), round(p['lon'], 6)] for p in geom],
                'start': first_pt,
                'end': last_pt
            })
            
        with open('scripts/osm_motorway_ways.json', 'w') as f:
            json.dump(southbound_ways, f, indent=2)
            
except Exception as e:
    print("Overpass error:", e)

