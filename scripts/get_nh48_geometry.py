import urllib.request
import json

query = """
[out:json];
way["highway"~"trunk|motorway|primary"]["name"~"Delhi.*Gurugram|NH.*48|Expressway"](28.47,77.06,28.51,77.10);
out geom;
"""
url = 'https://overpass-api.de/api/interpreter'
req = urllib.request.Request(url, data=query.encode('utf-8'), headers={'User-Agent': 'VeloAiPaceCoach/1.0'})

try:
    with urllib.request.urlopen(req, timeout=12) as res:
        data = json.loads(res.read().decode())
        print(f"Overpass returned {len(data['elements'])} elements")
        elements = data['elements']
        for el in elements:
            tags = el.get('tags', {})
            geom = el.get('geometry', [])
            name = tags.get('name', '')
            oneway = tags.get('oneway', '')
            print(f"ID {el['id']}: {name} (oneway={oneway}) -> {len(geom)} points")
            if geom:
                print(f"   Start: [{geom[0]['lat']}, {geom[0]['lon']}] -> End: [{geom[-1]['lat']}, {geom[-1]['lon']}]")
        with open('scripts/overpass_nh48.json', 'w', encoding='utf-8') as f:
            json.dump(elements, f, indent=2)
except Exception as e:
    print("Overpass error:", e)

