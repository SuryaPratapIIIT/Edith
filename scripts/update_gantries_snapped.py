import json

with open('src/data/calibratedRoadCorridors.json', 'r', encoding='utf-8') as f:
    corridors = json.load(f)

with open('data/gantries.json', 'r', encoding='utf-8') as f:
    gantries = json.load(f)

# Snapped map from previous run
snapped_coords = {
    'GMDA-NH48-01': [28.501036, 77.091512],
    'GMDA-NH48-02': [28.478109, 77.069430],
    'GMDA-NH48-03': [28.473646, 77.063757],
    'GMDA-NH48-04': [28.468526, 77.057311],
    'GMDA-NH48-05': [28.454378, 77.044394],
    'GMDA-NH48-06': [28.445508, 77.033597],
    'GMDA-NH48-07': [28.435464, 77.010077],
    'GMDA-NH48-08': [28.361593, 76.938491],
    'GMDA-GCR-01': [28.478900, 77.093910],
    'GMDA-GCR-02': [28.468101, 77.094508],
    'GMDA-GCR-03': [28.457994, 77.096972],
    'GMDA-GCR-04': [28.445341, 77.098603],
    'GMDA-GCR-05': [28.417389, 77.091099],
    'GMDA-SOHNA-01': [28.435897, 77.040145],
    'GMDA-SOHNA-02': [28.401446, 77.043549],
    'GMDA-HCC-01': [28.458591, 77.072832],
    'GMDA-BAKH-01': [28.437494, 77.058495],
    'GMDA-MEDANTA-01': [28.439702, 77.046414],
    'GMDA-MGROAD-01': [28.482813, 77.091486],
    'GMDA-MGROAD-02': [28.490336, 77.108001],
    'GMDA-GCREXT-01': [28.406563, 77.081499],
    'GMDA-GCREXT-02': [28.398003, 77.071057],
    'GMDA-OLDDEL-01': [28.488268, 77.044413],
    'GMDA-DWE-01': [28.515096, 77.028002]
}

for g in gantries:
    if g['id'] in snapped_coords:
        lat, lon = snapped_coords[g['id']]
        g['lat'] = lat
        g['lon'] = lon
        g['coords'] = [lon, lat]

with open('data/gantries.json', 'w', encoding='utf-8') as f:
    json.dump(gantries, f, indent=2)

with open('src/data/gantries.json', 'w', encoding='utf-8') as f:
    json.dump(gantries, f, indent=2)

print("Updated data/gantries.json and src/data/gantries.json with exact snapped road coordinates!")

