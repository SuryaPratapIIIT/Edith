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

def fetch_osrm_route(start, end, label=""):
    lon1, lat1 = start[1], start[0]
    lon2, lat2 = end[1], end[0]
    url = f"https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson"
    print(f"Fetching {label}: ({lat1},{lon1}) -> ({lat2},{lon2})")
    req = urllib.request.Request(url, headers={'User-Agent': 'VeloAiPaceCoach/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            if not data.get('routes'):
                print(f"  No route found for {label}")
                return None
            route = data['routes'][0]
            coords = [[round(c[1], 6), round(c[0], 6)] for c in route['geometry']['coordinates']]
            dist = round(route['distance'])
            print(f"  Success for {label}! Dist: {dist}m, Points: {len(coords)}")
            return coords
    except Exception as e:
        print(f"  Error fetching {label}: {e}")
        return None

def main():
    # 1. NH-48 Corridor: Ambience Mall to IMT Manesar
    # We query in key segments along the actual highway
    nh48_waypoints = [
        ("Ambience Mall", [28.5042, 77.0967]),
        ("Shankar Chowk", [28.5020, 77.0875]),
        ("Atlas Chowk", [28.4777, 77.0693]),
        ("IFFCO Chowk", [28.4722, 77.0645]),
        ("Signature Tower", [28.4635, 77.0545]),
        ("Jharsa Chowk", [28.4519, 77.0419]),
        ("Rajiv Chowk", [28.4445, 77.0325]),
        ("Hero Honda Chowk", [28.4359, 77.0101]),
        ("Kherki Daula Toll", [28.4010, 76.9780]),
        ("IMT Manesar", [28.3616, 76.9385])
    ]

    all_corridors = {}

    full_nh48 = []
    for i in range(len(nh48_waypoints) - 1):
        name1, pt1 = nh48_waypoints[i]
        name2, pt2 = nh48_waypoints[i+1]
        seg = fetch_osrm_route(pt1, pt2, f"NH48: {name1} -> {name2}")
        if seg:
            if not full_nh48:
                full_nh48.extend(seg)
            else:
                full_nh48.extend(seg[1:])
    all_corridors['NH48_FULL'] = full_nh48

    # 2. Golf Course Road: Sikanderpur to Rajesh Pilot / Sector 56
    gcr_waypoints = [
        ("Sikanderpur", [28.4830, 77.0915]),
        ("Bristol Chowk", [28.4789, 77.0939]),
        ("Khusboo Chowk", [28.4681, 77.0945]),
        ("Sector 27-43 Underpass", [28.4580, 77.0970]),
        ("Genpact Underpass", [28.4450, 77.0985]),
        ("Rajesh Pilot Chowk (Sec 56)", [28.4174, 77.0911])
    ]
    full_gcr = []
    for i in range(len(gcr_waypoints) - 1):
        name1, pt1 = gcr_waypoints[i]
        name2, pt2 = gcr_waypoints[i+1]
        seg = fetch_osrm_route(pt1, pt2, f"GCR: {name1} -> {name2}")
        if seg:
            if not full_gcr:
                full_gcr.extend(seg)
            else:
                full_gcr.extend(seg[1:])
    all_corridors['GCR_FULL'] = full_gcr

    # 3. Sohna Road: Rajiv Chowk to Vatika Chowk
    sohna_waypoints = [
        ("Rajiv Chowk", [28.4445, 77.0325]),
        ("Subhash Chowk", [28.4360, 77.0400]),
        ("Islampur", [28.4280, 77.0410]),
        ("Sector 48/49", [28.4180, 77.0420]),
        ("Vatika Chowk (Badshahpur)", [28.4022, 77.0435])
    ]
    full_sohna = []
    for i in range(len(sohna_waypoints) - 1):
        name1, pt1 = sohna_waypoints[i]
        name2, pt2 = sohna_waypoints[i+1]
        seg = fetch_osrm_route(pt1, pt2, f"Sohna: {name1} -> {name2}")
        if seg:
            if not full_sohna:
                full_sohna.extend(seg)
            else:
                full_sohna.extend(seg[1:])
    all_corridors['SOHNA_RD'] = full_sohna

    # 4. MG Road: IFFCO Chowk to Sikanderpur to Mehrauli Border
    mg_waypoints = [
        ("IFFCO Chowk", [28.4722, 77.0645]),
        ("MG Road Metro", [28.4795, 77.0805]),
        ("Sikanderpur", [28.4830, 77.0915]),
        ("Guru Dronacharya Metro", [28.4905, 77.1085]),
        ("Mehrauli Border", [28.4960, 77.1230])
    ]
    full_mg = []
    for i in range(len(mg_waypoints) - 1):
        name1, pt1 = mg_waypoints[i]
        name2, pt2 = mg_waypoints[i+1]
        seg = fetch_osrm_route(pt1, pt2, f"MG: {name1} -> {name2}")
        if seg:
            if not full_mg:
                full_mg.extend(seg)
            else:
                full_mg.extend(seg[1:])
    all_corridors['MG_ROAD'] = full_mg

    # 5. Vikas Marg & Medanta Link: Jharsa to Medanta to Bakhtawar to Subhash Chowk
    vikas_waypoints = [
        ("Jharsa Chowk", [28.4519, 77.0419]),
        ("Medanta Hospital", [28.4398, 77.0465]),
        ("Bakhtawar Chowk", [28.4375, 77.0585]),
        ("Subhash Chowk", [28.4360, 77.0400])
    ]
    full_vikas = []
    for i in range(len(vikas_waypoints) - 1):
        name1, pt1 = vikas_waypoints[i]
        name2, pt2 = vikas_waypoints[i+1]
        seg = fetch_osrm_route(pt1, pt2, f"Vikas: {name1} -> {name2}")
        if seg:
            if not full_vikas:
                full_vikas.extend(seg)
            else:
                full_vikas.extend(seg[1:])
    all_corridors['VIKAS_MARG'] = full_vikas

    # 6. Golf Course Extension Road / SPR: Rajesh Pilot to Vatika Chowk
    spr_waypoints = [
        ("Rajesh Pilot Chowk", [28.4174, 77.0911]),
        ("Sector 62 Pioneer", [28.4065, 77.0815]),
        ("Sector 65 Urbana", [28.3980, 77.0710]),
        ("Vatika Chowk", [28.4022, 77.0435])
    ]
    full_spr = []
    for i in range(len(spr_waypoints) - 1):
        name1, pt1 = spr_waypoints[i]
        name2, pt2 = spr_waypoints[i+1]
        seg = fetch_osrm_route(pt1, pt2, f"SPR: {name1} -> {name2}")
        if seg:
            if not full_spr:
                full_spr.extend(seg)
            else:
                full_spr.extend(seg[1:])
    all_corridors['GCR_EXT_SPR'] = full_spr

    # Save all extracted real road centerlines
    with open('src/data/calibratedRoadCorridors.json', 'w', encoding='utf-8') as f:
        json.dump(all_corridors, f, indent=2)
    print("\nSaved calibrated road corridors successfully!")
    for k, v in all_corridors.items():
        print(f"  {k}: {len(v)} road-locked points")

if __name__ == '__main__':
    main()
