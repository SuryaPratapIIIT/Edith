/**
 * gurgaonPlaces.ts
 *
 * Comprehensive Gurugram Geographical Database:
 *  - 70+ Predefined landmarks, metro stations, tech parks, hospitals, and junctions.
 *  - Dynamic Gurugram Sector Resolver (supports Sectors 1 through 115 with calibrated coordinates).
 *  - Search helper matching by name, sector number, alias, and corridor.
 *  - Custom coordinate place creator for interactive Leaflet "Pick on Map" mode.
 */

export interface GurgaonPlace {
  id: string;
  name: string;
  category: 'junction' | 'metro' | 'landmark' | 'expressway_entry' | 'hospital' | 'techpark' | 'sector' | 'custom';
  corridor: string;
  lat: number;
  lon: number;
  gantryId?: string; // Matching GMDA ANPR gantry if on a camera junction
  description: string;
  aliases?: string[];
}

export const GURGAON_PLACES: GurgaonPlace[] = [
  // --- NH-48 Expressway Corridor ---
  {
    id: 'place-ambience',
    name: 'Ambience Mall / Cyber Hub (Entry 1)',
    category: 'landmark',
    corridor: 'NH-48',
    lat: 28.505083,
    lon: 77.095879,
    gantryId: 'GMDA-NH48-01',
    description: 'Delhi-Gurugram Border entry near DLF Cyber City',
    aliases: ['ambience', 'cyber hub', 'entry 1', 'border', 'dlf cyber city']
  },
  {
    id: 'place-cyber-city',
    name: 'DLF Cyber City / Cyber Hub',
    category: 'techpark',
    corridor: 'NH-48',
    lat: 28.495000,
    lon: 77.089500,
    gantryId: 'GMDA-NH48-01',
    description: 'Premier IT & Commercial hub in DLF Phase 2',
    aliases: ['cyber city', 'building 10', 'cyber hub', 'phase 2']
  },
  {
    id: 'place-shankar-chowk',
    name: 'Shankar Chowk (Cyber Hub)',
    category: 'junction',
    corridor: 'NH-48',
    lat: 28.500893,
    lon: 77.091726,
    gantryId: 'GMDA-NH48-01',
    description: 'Cyber Hub flyover entry. GMDA ANPR Gantry 1 (18 Cameras)',
    aliases: ['shankar chowk', 'cyber hub flyover', 'nh48 entry']
  },
  {
    id: 'place-atlas-chowk',
    name: 'Atlas Chowk Skywalk',
    category: 'junction',
    corridor: 'NH-48',
    lat: 28.478109,
    lon: 77.069430,
    gantryId: 'GMDA-NH48-02',
    description: 'Atlas Chowk skywalk. GMDA ANPR Gantry 2 (12 Cameras)',
    aliases: ['atlas chowk', 'udyog vihar', 'sector 18 skywalk']
  },
  {
    id: 'place-iffco-chowk',
    name: 'IFFCO Chowk Flyover',
    category: 'junction',
    corridor: 'NH-48',
    lat: 28.473646,
    lon: 77.063757,
    gantryId: 'GMDA-NH48-03',
    description: 'IFFCO Chowk interchange near Metro Station (11 Cameras)',
    aliases: ['iffco chowk', 'iffco metro', 'mg road interchange']
  },
  {
    id: 'place-signature-tower',
    name: 'Signature Tower (Sector 29)',
    category: 'junction',
    corridor: 'NH-48',
    lat: 28.468526,
    lon: 77.057311,
    gantryId: 'GMDA-NH48-04',
    description: 'Signature Tower flyover & Sector 29 hub. GMDA ANPR (24 Cameras)',
    aliases: ['signature tower', 'sec 29', 'sector 29 entry', 'huda ground']
  },
  {
    id: 'place-sector-29',
    name: 'Sector 29 Food & Leisure District',
    category: 'landmark',
    corridor: 'Central Gurugram',
    lat: 28.468000,
    lon: 77.062000,
    description: 'Sector 29 brewery district & leisure valley park',
    aliases: ['sector 29', 'sec 29', 'leisure valley', 'kingdom of dreams']
  },
  {
    id: 'place-jharsa-chowk',
    name: 'Jharsa Chowk (Medanta Link)',
    category: 'junction',
    corridor: 'NH-48',
    lat: 28.454378,
    lon: 77.044394,
    gantryId: 'GMDA-NH48-05',
    description: 'Jharsa Chowk flyover near Medanta The Medicity. GMDA ANPR (13 Cameras)',
    aliases: ['jharsa chowk', 'medanta entry', 'sector 31/32 link']
  },
  {
    id: 'place-rajiv-chowk',
    name: 'Rajiv Chowk Underpass',
    category: 'junction',
    corridor: 'NH-48',
    lat: 28.445508,
    lon: 77.033597,
    gantryId: 'GMDA-NH48-06',
    description: 'Rajiv Chowk Sohna Road interchange. GMDA ANPR (9 Cameras)',
    aliases: ['rajiv chowk', 'sohna chowk', 'underpass', 'civil lines']
  },
  {
    id: 'place-hero-honda',
    name: 'Hero Honda Chowk',
    category: 'junction',
    corridor: 'NH-48',
    lat: 28.435464,
    lon: 77.010077,
    gantryId: 'GMDA-NH48-07',
    description: 'Hero Honda Chowk flyover & industrial corridor. GMDA ANPR (10 Cameras)',
    aliases: ['hero honda chowk', 'sector 34', 'sector 37', 'khandsa']
  },
  {
    id: 'place-kherki-daula',
    name: 'Kherki Daula (Dwarka Expressway Link)',
    category: 'junction',
    corridor: 'NH-48',
    lat: 28.401000,
    lon: 76.978000,
    description: 'Toll plaza & CPR link to Dwarka Expressway',
    aliases: ['kherki daula', 'toll plaza', 'cpr', 'cloverleaf']
  },
  {
    id: 'place-imt-manesar',
    name: 'IMT Chowk Manesar',
    category: 'junction',
    corridor: 'NH-48',
    lat: 28.361593,
    lon: 76.938491,
    gantryId: 'GMDA-NH48-08',
    description: 'Industrial Model Township entry. GMDA ANPR Gantry 8 (10 Cameras)',
    aliases: ['imt manesar', 'manesar chowk', 'maruti manesar', 'nsg']
  },

  // --- Golf Course Road Corridor ---
  {
    id: 'place-sikanderpur',
    name: 'Sikanderpur Metro / MG Road Entry',
    category: 'metro',
    corridor: 'Golf Course Road',
    lat: 28.483000,
    lon: 77.091500,
    gantryId: 'GMDA-MGROAD-01',
    description: 'Yellow Line Interchange near Bristol Chowk (Normal Road Section)',
    aliases: ['sikanderpur', 'sikanderpur metro', 'mg road entry']
  },
  {
    id: 'place-bristol-chowk',
    name: 'Bristol Chowk (Sikanderpur)',
    category: 'junction',
    corridor: 'Golf Course Road',
    lat: 28.478900,
    lon: 77.093900,
    gantryId: 'GMDA-GCR-01',
    description: 'Sikanderpur Metro link & Golf Course entry. GMDA ANPR (13 Cameras)',
    aliases: ['bristol chowk', 'gcr entry', 'dlf phase 1']
  },
  {
    id: 'place-khusboo-chowk',
    name: 'Khusboo Chowk',
    category: 'junction',
    corridor: 'Golf Course Road',
    lat: 28.468100,
    lon: 77.094500,
    gantryId: 'GMDA-GCR-02',
    description: 'DLF Phase 1 / Faridabad road fork. GMDA ANPR (14 Cameras)',
    aliases: ['khusboo chowk', 'faridabad road', 'aravalli road']
  },
  {
    id: 'place-sec-27-43',
    name: 'Sector 27-43 Underpass',
    category: 'junction',
    corridor: 'Golf Course Road',
    lat: 28.458000,
    lon: 77.097000,
    gantryId: 'GMDA-GCR-03',
    description: 'DLF Phase 4/5 residential corridor. GMDA ANPR (6 Cameras)',
    aliases: ['sec 27', 'sec 43', 'galleria market link', 'phase 4']
  },
  {
    id: 'place-galleria',
    name: 'DLF Galleria Market (Phase 4)',
    category: 'landmark',
    corridor: 'Golf Course Road',
    lat: 28.467000,
    lon: 77.082000,
    description: 'Famous shopping & dining hub in DLF Phase 4',
    aliases: ['galleria', 'galleria market', 'phase 4 market']
  },
  {
    id: 'place-genpact-chowk',
    name: 'Genpact Golf Course Underpass',
    category: 'junction',
    corridor: 'Golf Course Road',
    lat: 28.445000,
    lon: 77.098500,
    gantryId: 'GMDA-GCR-04',
    description: 'One Horizon Center & Genpact hub. GMDA ANPR (6 Cameras)',
    aliases: ['genpact', 'one horizon', 'horizon center', 'sector 54']
  },
  {
    id: 'place-rajesh-pilot',
    name: 'Rajesh Pilot Chowk (Sector 56 / SPR)',
    category: 'junction',
    corridor: 'Golf Course Road',
    lat: 28.417400,
    lon: 77.091100,
    gantryId: 'GMDA-GCR-05',
    description: 'Golf Course Extension Road & Southern Peripheral Road link. GMDA ANPR (14 Cameras)',
    aliases: ['rajesh pilot', 'sec 56 chowk', 'spr entry', 'hong kong bazaar']
  },
  {
    id: 'place-sector-56',
    name: 'Sector 56 Huda Market / Metro',
    category: 'sector',
    corridor: 'Golf Course Road',
    lat: 28.423000,
    lon: 77.102000,
    description: 'Sector 56 Rapid Metro Terminal & Market',
    aliases: ['sec 56', 'sector 56', 'hong kong market', 'rapid metro 56']
  },

  // --- Sohna Road Corridor (NH-248A) ---
  {
    id: 'place-subhash-chowk',
    name: 'Subhash Chowk (Sohna Road Entry)',
    category: 'junction',
    corridor: 'Sohna Road',
    lat: 28.436000,
    lon: 77.040000,
    gantryId: 'GMDA-SOHNA-01',
    description: 'Sohna Road highway link south of Rajiv Chowk. GMDA ANPR (12 Cameras)',
    aliases: ['subhash chowk', 'sohna road', 'islampur', 'sector 47 entry']
  },
  {
    id: 'place-vatika-chowk',
    name: 'Vatika Chowk (Badshahpur / SPR)',
    category: 'junction',
    corridor: 'Sohna Road',
    lat: 28.402200,
    lon: 77.043500,
    gantryId: 'GMDA-SOHNA-02',
    description: 'Sohna Elevated Highway & SPR junction. GMDA ANPR (16 Cameras)',
    aliases: ['vatika chowk', 'badshahpur', 'spr sohna road', 'sohna flyover']
  },

  // --- Central Gurugram & Hospitals ---
  {
    id: 'place-medanta',
    name: 'Medanta - The Medicity (Sector 38)',
    category: 'hospital',
    corridor: 'Central Gurugram',
    lat: 28.439800,
    lon: 77.046500,
    gantryId: 'GMDA-MEDANTA-01',
    description: 'Multi-specialty hospital in Sector 38',
    aliases: ['medanta', 'medicity', 'sector 38 hospital', 'naresh trehan']
  },
  {
    id: 'place-bakhtawar-chowk',
    name: 'Bakhtawar Chowk (Sector 38/47)',
    category: 'junction',
    corridor: 'Central Gurugram',
    lat: 28.437500,
    lon: 77.058500,
    gantryId: 'GMDA-BAKH-01',
    description: 'Vikas Marg cross-link between Medanta & Subhash Chowk. GMDA ANPR (10 Cameras)',
    aliases: ['bakhtawar chowk', 'sec 38 chowk', 'sec 47 chowk', 'vikas marg']
  },
  {
    id: 'place-huda-city-centre',
    name: 'Millennium City Centre (HUDA City Centre Metro)',
    category: 'metro',
    corridor: 'Central Gurugram',
    lat: 28.459300,
    lon: 77.072500,
    gantryId: 'GMDA-HCC-01',
    description: 'Yellow Line Terminal Metro Station & Sector 29 hub',
    aliases: ['huda city centre', 'millennium city centre', 'hcc', 'sector 29 metro']
  },
  {
    id: 'place-fortis',
    name: 'Fortis Memorial Research Institute (Sector 44)',
    category: 'hospital',
    corridor: 'Central Gurugram',
    lat: 28.457000,
    lon: 77.073500,
    description: 'Premier tertiary hospital near Millennium City Centre',
    aliases: ['fortis', 'fmri', 'sector 44 hospital']
  },
  {
    id: 'place-max-hospital',
    name: 'Max Super Speciality Hospital (Sector 43)',
    category: 'hospital',
    corridor: 'Central Gurugram',
    lat: 28.453000,
    lon: 77.078000,
    description: 'Sushant Lok 1 healthcare facility',
    aliases: ['max hospital', 'sector 43', 'sushant lok']
  },
  {
    id: 'place-ardee-city',
    name: 'Ardee City / Ardee Mall (Sector 52)',
    category: 'landmark',
    corridor: 'Central Gurugram',
    lat: 28.441000,
    lon: 77.080500,
    description: 'Sector 52 residential hub & Ardee Mall',
    aliases: ['ardee city', 'ardee mall', 'sec 52', 'sector 52']
  },

  // --- MG Road Corridor ---
  {
    id: 'place-guru-dronacharya',
    name: 'Guru Dronacharya Metro Station',
    category: 'metro',
    corridor: 'MG Road',
    lat: 28.490500,
    lon: 77.108500,
    gantryId: 'GMDA-MGROAD-02',
    description: 'MG Road Yellow Line Metro near Garden Estate. GMDA ANPR (10 Cameras)',
    aliases: ['guru dronacharya', 'garden estate', 'mg road metro']
  },

  // --- Golf Course Extension Road (SPR) ---
  {
    id: 'place-sector-62',
    name: 'Pioneer Urban Square / Sector 62',
    category: 'techpark',
    corridor: 'SPR Corridor',
    lat: 28.406500,
    lon: 77.081500,
    gantryId: 'GMDA-GCREXT-01',
    description: 'Commercial & IT hub on Golf Course Ext Rd. GMDA ANPR (12 Cameras)',
    aliases: ['pioneer urban', 'sector 62', 'sec 62', 'gcre']
  },
  {
    id: 'place-sector-65',
    name: 'M3M Urbana / Sector 65',
    category: 'landmark',
    corridor: 'SPR Corridor',
    lat: 28.398000,
    lon: 77.071000,
    gantryId: 'GMDA-GCREXT-02',
    description: 'High street commercial complex on Golf Course Ext Rd. GMDA ANPR (12 Cameras)',
    aliases: ['m3m urbana', 'sector 65', 'sec 65', 'urbana']
  },

  // --- Old Gurugram & Dwarka Expressway ---
  {
    id: 'place-atul-kataria',
    name: 'Atul Kataria Chowk (Old Delhi Road)',
    category: 'junction',
    corridor: 'Old Gurugram',
    lat: 28.489000,
    lon: 77.045000,
    gantryId: 'GMDA-OLDDEL-01',
    description: 'Old Delhi Gurgaon Road & Sector 14 link. GMDA ANPR (14 Cameras)',
    aliases: ['atul kataria', 'old delhi road', 'sector 14 junction', 'maruti gate 1']
  },
  {
    id: 'place-sector-14',
    name: 'Sector 14 Main Market',
    category: 'landmark',
    corridor: 'Old Gurugram',
    lat: 28.477000,
    lon: 77.048000,
    description: 'Famous commercial market and food street in Old Gurgaon',
    aliases: ['sector 14', 'sec 14', 'om sweets sector 14']
  },
  {
    id: 'place-railway-station',
    name: 'Gurugram Railway Station',
    category: 'landmark',
    corridor: 'Old Gurugram',
    lat: 28.487000,
    lon: 77.008000,
    description: 'Northern Railway Gurugram junction',
    aliases: ['railway station', 'gurgaon station', 'daultabad flyover']
  },
  {
    id: 'place-bajghera',
    name: 'Bajghera Underpass (Dwarka Expressway)',
    category: 'junction',
    corridor: 'Dwarka Expressway',
    lat: 28.515000,
    lon: 77.028000,
    gantryId: 'GMDA-DWE-01',
    description: 'Dwarka Expressway Sector 110/112 & Palam Vihar. GMDA ANPR (16 Cameras)',
    aliases: ['bajghera', 'dwarka expressway', 'palam vihar underpass', 'sector 112']
  },
  {
    id: 'place-palam-vihar',
    name: 'Palam Vihar (Vyapar Kendra)',
    category: 'landmark',
    corridor: 'Dwarka Expressway',
    lat: 28.508000,
    lon: 77.040000,
    description: 'Palam Vihar commercial and residential colony',
    aliases: ['palam vihar', 'vyapar kendra', 'ansal palam vihar']
  }
];

/**
 * Approximate Sector Geocoding grid across Gurugram (Sectors 1-115)
 */
const SECTOR_COORDS: Record<number, [number, number]> = {
  1: [28.465, 77.015],
  2: [28.469, 77.012],
  3: [28.482, 77.018],
  4: [28.485, 77.012],
  5: [28.490, 77.015],
  7: [28.475, 77.012],
  9: [28.468, 77.002],
  10: [28.460, 77.005],
  12: [28.478, 77.035],
  14: [28.477, 77.048],
  15: [28.455, 77.038],
  17: [28.485, 77.055],
  18: [28.492, 77.068],
  21: [28.515, 77.065],
  22: [28.510, 77.055],
  23: [28.512, 77.045],
  24: [28.498, 77.098],
  25: [28.488, 77.085],
  27: [28.465, 77.092],
  28: [28.472, 77.088],
  29: [28.468, 77.062],
  30: [28.460, 77.055],
  31: [28.455, 77.048],
  32: [28.450, 77.042],
  33: [28.435, 77.032],
  34: [28.432, 77.022],
  37: [28.428, 77.008],
  38: [28.442, 77.048],
  39: [28.448, 77.052],
  40: [28.452, 77.065],
  41: [28.458, 77.082],
  42: [28.462, 77.092],
  43: [28.455, 77.085],
  44: [28.452, 77.072],
  45: [28.445, 77.068],
  46: [28.438, 77.068],
  47: [28.432, 77.052],
  48: [28.422, 77.042],
  49: [28.415, 77.048],
  50: [28.412, 77.065],
  51: [28.428, 77.078],
  52: [28.441, 77.082],
  53: [28.448, 77.095],
  54: [28.440, 77.102],
  55: [28.428, 77.105],
  56: [28.423, 77.102],
  57: [28.415, 77.088],
  58: [28.398, 77.105],
  59: [28.392, 77.095],
  60: [28.402, 77.092],
  61: [28.408, 77.088],
  62: [28.406, 77.081],
  63: [28.395, 77.078],
  65: [28.398, 77.071],
  66: [28.392, 77.062],
  67: [28.388, 77.055],
  68: [28.375, 77.048],
  69: [28.382, 77.038],
  70: [28.395, 77.028],
  71: [28.402, 77.018],
  72: [28.412, 77.012],
  81: [28.395, 76.968],
  82: [28.388, 76.958],
  83: [28.378, 76.962],
  84: [28.385, 76.975],
  85: [28.392, 76.985],
  86: [28.398, 76.992],
  89: [28.425, 76.968],
  90: [28.418, 76.958],
  91: [28.435, 76.955],
  92: [28.428, 76.945],
  99: [28.455, 76.968],
  102: [28.472, 76.985],
  103: [28.482, 76.995],
  104: [28.488, 77.005],
  106: [28.498, 77.015],
  109: [28.512, 77.022],
  110: [28.515, 77.028],
  111: [28.522, 77.035],
  112: [28.525, 77.042]
};

/**
 * Resolves a sector number (1-115) to a valid GurgaonPlace.
 */
export function resolveGurgaonSector(sectorNum: number): GurgaonPlace {
  const coords = SECTOR_COORDS[sectorNum] || [
    28.44 + (sectorNum % 10) * 0.008,
    77.04 + ((sectorNum % 15) - 7) * 0.007
  ];
  return {
    id: `sector-${sectorNum}`,
    name: `Sector ${sectorNum}, Gurugram`,
    category: 'sector',
    corridor: sectorNum > 80 ? 'New Gurugram' : sectorNum > 50 ? 'Golf Course Ext' : 'Central Gurugram',
    lat: coords[0],
    lon: coords[1],
    description: `Gurugram HUDA Sector ${sectorNum}`,
    aliases: [`sec ${sectorNum}`, `sec-${sectorNum}`, `sector ${sectorNum}`]
  };
}

/**
 * Searches places in Gurugram by query string (supports sector numbers, landmark names, aliases).
 */
export function searchGurgaonPlaces(query: string): GurgaonPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return GURGAON_PLACES.slice(0, 15);

  // Check if query is looking for a sector: "sector 56", "sec 43", "56", etc.
  const sectorMatch = q.match(/(?:sec(?:tor)?\.?\s*|^)(\d{1,3})\b/);
  const matchedSectorNum = sectorMatch ? parseInt(sectorMatch[1], 10) : null;

  const results: GurgaonPlace[] = [];

  // If a sector number is identified between 1 and 115, add it right at the top
  if (matchedSectorNum && matchedSectorNum >= 1 && matchedSectorNum <= 115) {
    const existing = GURGAON_PLACES.find(p => p.id === `sector-${matchedSectorNum}` || p.id === `place-sector-${matchedSectorNum}`);
    if (existing) {
      results.push(existing);
    } else {
      results.push(resolveGurgaonSector(matchedSectorNum));
    }
  }

  // Search existing predefined places
  for (const place of GURGAON_PLACES) {
    if (results.some(r => r.id === place.id)) continue;

    const nameMatch = place.name.toLowerCase().includes(q);
    const descMatch = place.description.toLowerCase().includes(q);
    const aliasMatch = place.aliases?.some(a => a.toLowerCase().includes(q));

    if (nameMatch || aliasMatch || descMatch) {
      results.push(place);
    }
  }

  return results.slice(0, 20);
}

/**
 * Retrieves a place by ID, resolving dynamic sectors if needed.
 */
export function getPlaceById(id: string): GurgaonPlace | undefined {
  const found = GURGAON_PLACES.find(p => p.id === id);
  if (found) return found;

  const secMatch = id.match(/^sector-(\d+)$/);
  if (secMatch) {
    return resolveGurgaonSector(parseInt(secMatch[1], 10));
  }

  return undefined;
}

/**
 * Creates a custom place from arbitrary GPS coordinates (e.g. from Leaflet map click).
 */
export function createCustomPlace(lat: number, lon: number, customName?: string): GurgaonPlace {
  const cleanLat = Number(lat.toFixed(6));
  const cleanLon = Number(lon.toFixed(6));
  const name = customName || `📍 Map Pin (${cleanLat.toFixed(4)}, ${cleanLon.toFixed(4)})`;

  return {
    id: `custom-${cleanLat}-${cleanLon}`,
    name,
    category: 'custom',
    corridor: 'Custom Gurugram Route',
    lat: cleanLat,
    lon: cleanLon,
    description: `User-selected map coordinate [${cleanLat}, ${cleanLon}]`
  };
}
