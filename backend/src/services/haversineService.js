export const EARTH_RADIUS_KM = 6371;

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/**
 * Haversine distance between two coordinates in kilometers.
 * a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)
 * c = 2·atan2(√a, √(1−a))
 * d = R·c
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const args = [lat1, lon1, lat2, lon2].map(Number);
  if (args.some((v) => Number.isNaN(v))) throw new TypeError('Coordinates must be numeric');
  const [φ1, λ1, φ2, λ2] = args.map(toRad);
  const dLat = φ2 - φ1;
  const dLon = λ2 - λ1;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Initial bearing in degrees (0-360) from point 1 to point 2. */
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(Number(lat1));
  const φ2 = toRad(Number(lat2));
  const Δλ = toRad(Number(lon2) - Number(lon1));
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Points within radius (km) of a center, each item must have latitude/longitude. */
export function filterByRadius(items, centerLat, centerLng, radiusKm) {
  return items
    .filter((item) => (
      item.latitude != null && item.longitude != null &&
      Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))
    ))
    .map((item) => {
      const distanceKm = haversineKm(centerLat, centerLng, item.latitude, item.longitude);
      return { ...item, distanceKm: Math.round(distanceKm * 100) / 100 };
    })
    .filter((item) => item.distanceKm <= radiusKm);
}

export default { haversineKm, bearingDeg, filterByRadius, EARTH_RADIUS_KM };
