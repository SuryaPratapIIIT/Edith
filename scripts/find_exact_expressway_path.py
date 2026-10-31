import urllib.request
import json

# Query OSRM nearest to snap points directly to the Delhi-Gurugram Expressway
test_pts = [
    [28.5020, 77.0875], # Near Shankar Chowk / DLF Cyber Hub flyover
    [28.4980, 77.0850], # Expressway past Sirhaul
    [28.4940, 77.0815], # Expressway alongside Sector 18 / 25
    [28.4900, 77.0780], # Expressway past Maruti Udyog
    [28.4860, 77.0745], # Expressway approach to Atlas Chowk
    [28.4810, 77.0710], # Expressway flyover approach
    [28.4777, 77.0693]  # Atlas Chowk interchange
]

snapped = []
for lat, lon in test_pts:
    url = f"https://router.project-osrm.org/nearest/v1/driving/{lon},{lat}?number=1"
    req = urllib.request.Request(url, headers={'User-Agent': 'VeloAiPaceCoach/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=4) as res:
            data = json.loads(res.read().decode())
            loc = data['waypoints'][0]['location'] # [lon, lat]
            name = data['waypoints'][0].get('name', '')
            snapped.append([round(loc[1], 6), round(loc[0], 6)])
            print(f"Input: [{lat}, {lon}] -> Snapped to: [{loc[1]}, {loc[0]}] ({name})")
    except Exception as e:
        print(f"Error on [{lat}, {lon}]: {e}")

# Now query driving route between first and last snapped point
if len(snapped) >= 2:
    start = snapped[0]
    end = snapped[-1]
    url_route = f"https://router.project-osrm.org/route/v1/driving/{start[1]},{start[0]};{end[1]},{end[0]}?overview=full&geometries=geojson"
    req_route = urllib.request.Request(url_route, headers={'User-Agent': 'VeloAiPaceCoach/1.0'})
    try:
        with urllib.request.urlopen(req_route, timeout=6) as res:
            data = json.loads(res.read().decode())
            route = data['routes'][0]
            coords = route['geometry']['coordinates']
            print(f"\nExact Expressway Driving Route: {route['distance']} meters, {len(coords)} coordinates")
            highway_coords = [[round(c[1], 6), round(c[0], 6)] for c in coords]
            with open('scripts/exact_nh48_highway.json', 'w') as f:
                json.dump(highway_coords, f, indent=2)
            print("First 3:", highway_coords[:3])
            print("Middle 3:", highway_coords[len(highway_coords)//2 : len(highway_coords)//2 + 3])
            print("Last 3:", highway_coords[-3:])
    except Exception as e:
        print("Route error:", e)

