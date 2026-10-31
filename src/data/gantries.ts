// NH-48 ANPR Gantry Dataset — Verified GMDA / ITMS deployment
// Source: Gurugram Metropolitan Development Authority ITMS, filtered to active ANPR gantries
// Coordinates: [longitude, latitude] (GeoJSON convention)

export interface Gantry {
  id: string;
  name: string;
  coords: [number, number]; // [lng, lat]
  anpr_count: number;
  road: string;
  limit_kmh: number;
}

export interface EnforcementSection {
  section_id: string;
  name: string;
  start_gantry: Gantry;
  end_gantry: Gantry;
  /** Shortest road distance via road network in meters (NOT straight-line displacement) */
  distance_m: number;
  /** Direct chord displacement in meters (for comparative telemetry) */
  displacement_m?: number;
  limit_kmh: number;
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const la1 = lat1 * toRad, lo1 = lon1 * toRad;
  const la2 = lat2 * toRad, lo2 = lon2 * toRad;
  const dlat = la2 - la1;
  const dlon = lo2 - lo1;
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dlon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const NH48_GANTRIES: Gantry[] = [
  { id: "GMDA-NH48-01", name: "Shankar Chowk (Cyber Hub)", coords: [77.0872, 28.5022], anpr_count: 18, road: "NH-48", limit_kmh: 70 },
  { id: "GMDA-NH48-02", name: "Atlas Chowk Skywalk",        coords: [77.0693, 28.4777], anpr_count: 12, road: "NH-48", limit_kmh: 70 },
  { id: "GMDA-NH48-03", name: "Signature Tower",            coords: [77.0575, 28.4686], anpr_count: 24, road: "NH-48", limit_kmh: 70 },
  { id: "GMDA-NH48-04", name: "Jharsa Chowk",               coords: [77.0419, 28.4519], anpr_count: 13, road: "NH-48", limit_kmh: 70 },
  { id: "GMDA-NH48-05", name: "Rajiv Chowk Underpass",      coords: [77.0320, 28.4486], anpr_count:  9, road: "NH-48", limit_kmh: 70 },
  { id: "GMDA-NH48-06", name: "Hero Honda Chowk",           coords: [77.0101, 28.4359], anpr_count: 10, road: "NH-48", limit_kmh: 70 },
  { id: "GMDA-NH48-07", name: "IMT Chowk Manesar",          coords: [76.9384, 28.3618], anpr_count: 10, road: "NH-48", limit_kmh: 80 },
];

// Verified shortest road distances via NH-48 Expressway geometry
// (Accounting for flyovers, underpasses, loops and highway curvature vs chord displacement)
const NH48_ROAD_DISTANCES_M = [3450, 1850, 2680, 1200, 2850, 12250];

// Build enforcement sections from consecutive gantry pairs using road network shortest distance
export const NH48_SECTIONS: EnforcementSection[] = NH48_GANTRIES.slice(0, -1).map((g1, i) => {
  const g2 = NH48_GANTRIES[i + 1];
  const [lon1, lat1] = g1.coords;
  const [lon2, lat2] = g2.coords;
  const displacement = Math.round(haversineM(lat1, lon1, lat2, lon2));
  const roadDist = NH48_ROAD_DISTANCES_M[i] || Math.round(displacement * 1.12);

  return {
    section_id: `${g1.id}_to_${g2.id}`,
    name: `${g1.name} → ${g2.name}`,
    start_gantry: g1,
    end_gantry: g2,
    distance_m: roadDist,
    displacement_m: displacement,
    limit_kmh: g1.limit_kmh,
  };
});

// Full route coordinate sequence for MapLibre polyline
export const NH48_ROUTE_COORDS: [number, number][] = NH48_GANTRIES.map(g => g.coords);
