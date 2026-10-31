import { planJourney } from '../src/services/journeyService';

const journey = planJourney('place-ambience', 'place-rajiv-chowk');
console.log(`Journey Name: ${journey.name}`);
console.log(`Total Road Distance: ${journey.totalDistance_m} m (${(journey.totalDistance_m / 1000).toFixed(2)} km)`);
console.log(`Straight Displacement: ${journey.straightDisplacement_m} m (${(journey.straightDisplacement_m / 1000).toFixed(2)} km)`);
console.log(`Detour %: +${journey.detourPct}%`);
console.log(`Cameras Detected along road: ${journey.cameras.length}`);
for (const c of journey.cameras) {
  console.log(`  📷 ${c.name} at ${(c.journeyDistance_m / 1000).toFixed(2)} km [${c.lat}, ${c.lon}] (CTE: ${c.crossTrackError_m}m)`);
}
console.log(`Enforcement Zones Created: ${journey.enforcementZones.length}`);
for (const z of journey.enforcementZones) {
  console.log(`  🛡️ ${z.name}: ${z.length_m}m | Limit: ${z.limit_kmh} km/h | Detour: +${z.detourPct}%`);
}

// Verify that polyline does not cut across Sector 15-I (lat ~ 28.450, lon ~ 77.039)
const sec15_bad = journey.fullPolyline.filter(([lat, lon]) => lat > 28.450 && lat < 28.453 && lon > 77.038 && lon < 77.040);
console.log(`Sector 15-I Bad Intrusion Points: ${sec15_bad.length} (Expected: 0)`);

