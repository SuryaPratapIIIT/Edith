import urllib.request
import json

def main():
    # Shankar Chowk on Delhi-Gurugram Expressway (NH48)
    # The actual NH48 carriageway passing Shankar Chowk flyover to Atlas Chowk
    # Looking at the map in the screenshot:
    # Top-right of the red curve: [28.5015, 77.0870] near DLF Phase 3 / Shankar Chowk
    # Curving southwest along Delhi-Gurugram Expressway (past Sirhaul, Entry 4, Sector 18 boundary)
    # Reaching Atlas Chowk at [28.4777, 77.0693]
    
    url = "https://router.project-osrm.org/route/v1/driving/77.0875,28.5010;77.0693,28.4777?overview=full&geometries=geojson"
    req = urllib.request.Request(url, headers={'User-Agent': 'VeloAiPaceCoach/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=6) as res:
            data = json.loads(res.read().decode())
            route = data['routes'][0]
            coords = route['geometry']['coordinates']
            dist = route['distance']
            print(f"OSRM Route found! Distance: {dist} m, Points: {len(coords)}")
            lat_lons = [[round(c[1], 5), round(c[0], 5)] for c in coords]
            for i, p in enumerate(lat_lons):
                if i % (max(1, len(lat_lons) // 10)) == 0 or i == len(lat_lons) - 1:
                    print(f"  pt {i}: {p}")
            with open('scripts/nh48_accurate_polyline.json', 'w') as f:
                json.dump(lat_lons, f, indent=2)
    except Exception as e:
        print("Error fetching route:", e)

if __name__ == '__main__':
    main()

