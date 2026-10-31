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

# Single direct OSRM query from Ambience Mall SB directly to Rajiv Chowk SB!
# lon, lat format for OSRM
start_lon, start_lat = 77.0967, 28.5042
end_lon, end_lat = 77.0335, 28.4452

url = f"https://router.project-osrm.org/route/v1/driving/{start_lon},{start_lat};{end_lon},{end_lat}?overview=full&geometries=geojson"
req = urllib.request.Request(url, headers={'User-Agent': 'VeloAiRoadCalibrator/1.0'})

try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
        route = data['routes'][0]
        dist = route['distance']
        coords = route['geometry']['coordinates'] # [lon, lat]
        lat_lons = [[round(c[1], 6), round(c[0], 6)] for c in coords]
        print(f"Direct Route Found! Distance: {dist:.1f}m, Points: {len(lat_lons)}")
        
        # Check if there are any detours to DLF Phase 2 / Sector 25A (lon > 77.090 between Shankar & Atlas)
        # Shankar is around 28.500, Atlas is around 28.478
        detour_pts = [p for p in lat_lons if 28.478 < p[0] < 28.500 and p[1] > 77.088]
        print(f"Detour points in Sector 25A (lon > 77.088): {len(detour_pts)}")
        
        # Check if there are any points in Sector 15-I (lat ~ 28.450, lon ~ 77.039)
        sec15_pts = [p for p in lat_lons if 28.448 < p[0] < 28.452 and 77.038 < p[1] < 77.040]
        print(f"Points in Sector 15-I: {len(sec15_pts)}")
        
        with open('scripts/ambience_to_rajiv_direct.json', 'w') as f:
            json.dump(lat_lons, f, indent=2)
            
except Exception as e:
    print("Error:", e)

