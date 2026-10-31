import urllib.request
import json
import math
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 1. Kherki Daula to IMT Manesar extension
url_manesar = "https://router.project-osrm.org/route/v1/driving/76.9820,28.3954;76.9385,28.3616?overview=full&geometries=geojson"

# 2. Netaji Subhash Marg (Signature Tower to Millennium City Centre to Sector 43)
url_ns = "https://router.project-osrm.org/route/v1/driving/77.0573,28.4685;77.0725,28.4593;77.0780,28.4530?overview=full&geometries=geojson"

# 3. Old Delhi Gurgaon Road (IFFCO Chowk to Atul Kataria Chowk to Railway Station)
url_olddel = "https://router.project-osrm.org/route/v1/driving/77.0645,28.4722;77.0450,28.4890;77.0080,28.4870?overview=full&geometries=geojson"

# 4. Dwarka Expressway through Bajghera Underpass
url_dwe = "https://router.project-osrm.org/route/v1/driving/77.0340,28.5306;77.0280,28.5150;76.9710,28.4668?overview=full&geometries=geojson"

req_headers = {'User-Agent': 'VeloAiRoadCalibrator/1.0'}

res = {}
for name, url in [('MANESAR_EXT', url_manesar), ('NS_MARG', url_ns), ('OLD_DELHI_RD', url_olddel), ('DWARKA_EXPWY', url_dwe)]:
    try:
        req = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            coords = [[round(p[1], 6), round(p[0], 6)] for p in data['routes'][0]['geometry']['coordinates']]
            dist = data['routes'][0]['distance']
            print(f"✓ {name}: Dist={dist:.1f}m, Points={len(coords)}")
            res[name] = coords
    except Exception as e:
        print(f"Error on {name}: {e}")

with open('scripts/remaining_corridors.json', 'w', encoding='utf-8') as f:
    json.dump(res, f, indent=2)

