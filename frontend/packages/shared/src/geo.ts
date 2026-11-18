export interface Coordinates {
  lat: number;
  lng: number;
}
const EARTH_RADIUS_METRES = 6_371_000;
export function haversineDistanceMetres(a: Coordinates, b: Coordinates): number {
  for (const value of [a.lat, a.lng, b.lat, b.lng])
    if (!Number.isFinite(value)) throw new TypeError('Coordinates must be finite numbers');
  if (
    Math.abs(a.lat) > 90 ||
    Math.abs(b.lat) > 90 ||
    Math.abs(a.lng) > 180 ||
    Math.abs(b.lng) > 180
  )
    throw new RangeError('Coordinates are outside valid bounds');
  const radians = (degrees: number): number => (degrees * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function estimateEtaMinutes(distanceMetres: number, speedKmh = 25): number {
  if (
    !Number.isFinite(distanceMetres) ||
    distanceMetres < 0 ||
    !Number.isFinite(speedKmh) ||
    speedKmh <= 0
  )
    throw new RangeError('Distance and speed must be valid positive values');
  return Math.ceil(distanceMetres / ((speedKmh * 1_000) / 60));
}
