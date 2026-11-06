import { GurgaonPlace, searchGurgaonPlaces, resolveGurgaonSector } from '../data/gurgaonPlaces';

/**
 * In-memory LRU-like cache for geocoding queries to avoid redundant network calls.
 */
const geocodeCache = new Map<string, GurgaonPlace[]>();

/**
 * Normalizes query string for caching and comparison.
 */
function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Geocodes an address or place name using OpenStreetMap Nominatim.
 * Prioritizes Gurugram / NCR region without any hardcoded coordinates.
 */
export async function geocodeWithNominatim(query: string): Promise<GurgaonPlace[]> {
  const norm = normalizeQuery(query);
  if (!norm || norm.length < 2) return [];

  if (geocodeCache.has(norm)) {
    return geocodeCache.get(norm)!;
  }

  try {
    // If user query does not explicitly specify city, bias towards Gurugram / Haryana
    const searchParam = norm.includes('gurga') || norm.includes('delhi') || norm.includes('ncr') || norm.includes('haryana')
      ? query.trim()
      : `${query.trim()}, Gurugram, Haryana`;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchParam)}&countrycodes=in&limit=6&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      // Fallback: try raw query without city qualifier if specific search had no results
      if (searchParam !== query.trim()) {
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&countrycodes=in&limit=4&addressdetails=1`;
        const fbRes = await fetch(fallbackUrl, { headers: { 'Accept-Language': 'en' } });
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          if (Array.isArray(fbData) && fbData.length > 0) {
            const fbResults = mapNominatimResults(fbData);
            geocodeCache.set(norm, fbResults);
            return fbResults;
          }
        }
      }
      return [];
    }

    const results = mapNominatimResults(data);
    geocodeCache.set(norm, results);
    return results;
  } catch (err) {
    console.warn('[GEOCODING] Nominatim geocode request failed:', err);
    return [];
  }
}

/**
 * Maps raw OpenStreetMap Nominatim JSON to strongly typed GurgaonPlace objects.
 */
function mapNominatimResults(items: any[]): GurgaonPlace[] {
  return items.map((item, idx) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const cleanLat = Number(lat.toFixed(6));
    const cleanLon = Number(lon.toFixed(6));

    // Determine clean display name and category
    const rawName = item.name || item.display_name.split(',')[0].trim();
    const address = item.address || {};
    const suburb = address.suburb || address.neighbourhood || address.road || address.county || 'Gurugram';

    let category: GurgaonPlace['category'] = 'custom';
    if (item.addresstype === 'suburb' || /sector\s*\d+/i.test(rawName)) {
      category = 'sector';
    } else if (item.addresstype === 'junction' || item.class === 'junction' || /chowk|crossing|intersection/i.test(rawName)) {
      category = 'junction';
    } else if (item.class === 'amenity' && /hospital|clinic/i.test(item.type)) {
      category = 'hospital';
    } else if (item.class === 'railway' || /metro/i.test(rawName)) {
      category = 'metro';
    } else if (item.class === 'shop' || /mall/i.test(rawName)) {
      category = 'mall';
    }

    return {
      id: `nominatim-${item.place_id || idx}-${cleanLat}-${cleanLon}`,
      name: rawName,
      category,
      corridor: suburb,
      lat: cleanLat,
      lon: cleanLon,
      description: item.display_name,
      aliases: [rawName.toLowerCase(), normSectorAlias(rawName)]
    };
  });
}

function normSectorAlias(name: string): string {
  const m = name.match(/sector\s*(\d+)/i);
  return m ? `sec ${m[1]}` : name.toLowerCase();
}

/**
 * Combines local instant places (with sector 1-115 formulas) and geocoding results,
 * deduplicating items that refer to the same coordinates (< 150m apart).
 */
export function mergePlaceLists(localPlaces: GurgaonPlace[], geocodedPlaces: GurgaonPlace[]): GurgaonPlace[] {
  const merged: GurgaonPlace[] = [...localPlaces];

  for (const geo of geocodedPlaces) {
    const isDuplicate = merged.some((p) => {
      // Same ID or coordinates within ~150 meters
      if (p.id === geo.id) return true;
      const dLat = Math.abs(p.lat - geo.lat);
      const dLon = Math.abs(p.lon - geo.lon);
      return dLat < 0.0015 && dLon < 0.0015;
    });

    if (!isDuplicate) {
      merged.push(geo);
    }
  }

  return merged;
}

/**
 * Comprehensive place search:
 * 1. Synchronously returns local matches (sectors 1-115, landmarks, aliases).
 * 2. Asynchronously queries Nominatim to supplement with real-world chowks, addresses, and POIs.
 */
export async function searchPlacesCombined(
  query: string,
  onRemoteResults?: (results: GurgaonPlace[]) => void
): Promise<GurgaonPlace[]> {
  const local = searchGurgaonPlaces(query);

  if (query.trim().length >= 2) {
    geocodeWithNominatim(query).then((remote) => {
      if (remote.length > 0 && onRemoteResults) {
        const merged = mergePlaceLists(local, remote);
        onRemoteResults(merged);
      }
    });
  }

  return local;
}

/**
 * Resolves a text query to the single best matching GurgaonPlace:
 * Checks sector formulas, local database, and live geocoding.
 */
export async function resolveTextToPlace(query: string): Promise<GurgaonPlace | null> {
  const q = query.trim();
  if (!q) return null;

  // 1. Direct sector match (e.g. "Sector 45", "Sec 45", "sector-45", "45")
  const sectorMatch = q.match(/(?:sec(?:tor)?\.?[\s-]*|^)(\d{1,3})\b/i);
  if (sectorMatch) {
    const secNum = parseInt(sectorMatch[1], 10);
    if (secNum >= 1 && secNum <= 115) {
      return resolveGurgaonSector(secNum);
    }
  }

  // 2. Local exact or prefix match
  const local = searchGurgaonPlaces(q);
  if (local.length > 0) {
    // Check if first result closely matches
    const first = local[0];
    if (first.name.toLowerCase().includes(q.toLowerCase()) || q.toLowerCase().includes(first.name.toLowerCase())) {
      return first;
    }
  }

  // 3. Remote Nominatim Geocoding
  const remote = await geocodeWithNominatim(q);
  if (remote.length > 0) {
    return remote[0];
  }

  // 4. Fallback to top local result if any exists
  return local.length > 0 ? local[0] : null;
}
