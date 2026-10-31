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

with open('scripts/osm_motorway_ways.json', 'r', encoding='utf-8') as f:
    ways = json.load(f)

# The sequence of way IDs for southbound NH-48 from Ambience to Kherki Daula
southbound_way_ids = [
    646301466,   # North of Ambience border [28.5106, 77.0937] -> [28.5086, 77.0947]
    1508749204,  # Ambience Toll approach [28.5086, 77.0947] -> [28.5067, 77.0951]
    25878328,    # Ambience Mall [28.5067, 77.0951] -> [28.5052, 77.0948]
    646301470,    # Ambience to Shankar Chowk [28.5052, 77.0948] -> [28.4979, 77.0886]
    188137530,   # Shankar Chowk flyover [28.4979, 77.0886] -> [28.4932, 77.0842]
    25878325,    # Shankar to Atlas Chowk approach [28.4932, 77.0842] -> [28.4829, 77.0742]
    25878320,    # Atlas Chowk skywalk approach [28.4829, 77.0742] -> [28.4807, 77.0722]
    689449086,   # Atlas Chowk to IFFCO Chowk [28.4807, 77.0722] -> [28.4736, 77.0637]
    675122092,   # IFFCO Chowk [28.4736, 77.0637] -> [28.4732, 77.0632]
    25878318,    # IFFCO to Signature Tower approach [28.4732, 77.0632] -> [28.4710, 77.0604]
    25878314,    # Signature Tower flyover approach [28.4710, 77.0604] -> [28.4661, 77.0555]
    753609127,   # Signature Tower [28.4661, 77.0555] -> [28.4647, 77.0543]
    25878313,    # South of Signature Tower [28.4647, 77.0543] -> [28.4617, 77.0514]
    753609126,   # Jharsa approach 1 [28.4617, 77.0514] -> [28.4612, 77.0510]
    25878307,    # Jharsa approach 2 [28.4612, 77.0510] -> [28.4574, 77.0473]
    169321075,   # Jharsa approach 3 [28.4574, 77.0473] -> [28.4565, 77.0464]
    25878306,    # Jharsa Chowk flyover approach [28.4565, 77.0464] -> [28.4547, 77.0447]
    25878304,    # Jharsa Chowk [28.4547, 77.0447] -> [28.4543, 77.0443]
    169321076,   # Jharsa to Rajiv approach [28.4543, 77.0443] -> [28.4491, 77.0394]
    169321070,   # Rajiv Chowk curve approach [28.4491, 77.0394] -> [28.4485, 77.0388]
    25878301,    # Rajiv Chowk loop approach [28.4485, 77.0388] -> [28.4475, 77.0380]
    753609123,   # Rajiv Chowk underpass approach [28.4475, 77.0380] -> [28.4457, 77.0353]
    25878294,    # Rajiv Chowk Underpass [28.4457, 77.0353] -> [28.4458, 77.0318]
    190041491,   # Past Rajiv Chowk [28.4458, 77.0318] -> [28.4474, 77.0259]
    544221623,   # Towards Hero Honda [28.4474, 77.0259] -> [28.4373, 77.0117]
    544221626,   # Hero Honda Chowk flyover [28.4373, 77.0117] -> [28.4343, 77.0091]
    25878299     # Hero Honda to Kherki Daula [28.4343, 77.0091] -> [28.3954, 76.9820]
]

ways_by_id = {w['id']: w for w in ways}

stitched_nh48 = []
for wid in southbound_way_ids:
    if wid not in ways_by_id:
        print(f"Warning: Way {wid} not found!")
        continue
    w = ways_by_id[wid]
    pts = w['pts']
    if not stitched_nh48:
        stitched_nh48.extend(pts)
    else:
        # Check gap between previous end and this start
        last_pt = stitched_nh48[-1]
        first_pt = pts[0]
        gap = haversine(last_pt, first_pt)
        if gap > 1.0:
            print(f"Gap of {gap:.2f}m between ways at {wid} (from {last_pt} to {first_pt})")
        stitched_nh48.extend(pts[1:])

print(f"\nSuccessfully stitched NH-48 Southbound Carriageway: {len(stitched_nh48)} points!")
cum_dist = 0
for i in range(len(stitched_nh48) - 1):
    cum_dist += haversine(stitched_nh48[i], stitched_nh48[i+1])

print(f"Total Carriageway Length: {cum_dist:.1f} meters ({cum_dist/1000:.2f} km)")
print(f"First point: {stitched_nh48[0]}")
print(f"Last point: {stitched_nh48[-1]}")

with open('scripts/nh48_pure_southbound_osm.json', 'w', encoding='utf-8') as f:
    json.dump(stitched_nh48, f, indent=2)

