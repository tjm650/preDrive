/**
 * Verified, school-scoped road geometry for a transport route.
 *
 * Coordinates are ordered [longitude, latitude] (GeoJSON / WGS84 order).
 * Geometry is guidance only until a school operator has reviewed it.
 */
export type RouteCoordinate = readonly [
  longitude: number,
  latitude: number,
];

export interface RouteGeometry {
  id: string;
  schoolId: string;
  routeId: string;
  version: number;
  coordinates: readonly RouteCoordinate[];
  source: string;
  attribution: string;
  verifiedAt: string;
  verifiedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RouteGeometryValidationOptions {
  minimumCoordinates?: number;
}

/**
 * Validate geometry before it is displayed or persisted.
 * This intentionally does not invent or repair coordinates.
 */
export function validateRouteCoordinates(
  coordinates: readonly RouteCoordinate[],
  options: RouteGeometryValidationOptions = {},
): string[] {
  const errors: string[] = [];
  const minimumCoordinates = options.minimumCoordinates ?? 30;

  if (!Number.isInteger(minimumCoordinates) || minimumCoordinates < 2) {
    return ["The minimum coordinate count must be an integer of at least two."];
  }

  if (coordinates.length < minimumCoordinates) {
    errors.push(`Route geometry must contain at least ${minimumCoordinates} coordinates.`);
  }

  const distinct = new Set<string>();

  coordinates.forEach(([longitude, latitude], index) => {
    if (
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      errors.push(`Coordinate ${index + 1} is outside the valid WGS84 range.`);
      return;
    }

    distinct.add(`${longitude.toFixed(7)},${latitude.toFixed(7)}`);
  });

  if (distinct.size < minimumCoordinates) {
    errors.push(`Route geometry must contain at least ${minimumCoordinates} distinct coordinates.`);
  }

  return errors;
}
