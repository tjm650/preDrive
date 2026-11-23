# preDrive route geometry contract — B6 dependency

## Current state

The Greenfield foundation seed stores five ordered stop points per route as PostGIS geography points. The current `transport_routes` schema and shared `PreDriveApi` route model do not expose a road-path geometry field. Stop points are not a route polyline.

Do not approximate a road path by drawing straight lines between stops, interpolate 30 arbitrary coordinates, or store route geometry inside `settings`. Those approaches would make the map look convincing while potentially directing drivers across buildings, private property or non-roads.

## Proposed typed contract

A route geometry record should be school-scoped and versioned:

- `school_id`: tenant scope.
- `route_id`: composite FK to the route in the same school.
- `version`: monotonically increasing geometry version.
- `geometry`: PostGIS `geography(LineString, 4326)` or equivalent GeoJSON LineString.
- `source`: routing data source and attribution.
- `verified_at`: timestamp of school/operator review.
- `verified_by`: school staff profile.
- `created_at` / `updated_at`.

The shared API should expose a typed geometry value as ordered WGS84 coordinates in **[longitude, latitude]** order. Each production route must contain at least 30 distinct road-following coordinates, begin/end at the correct route endpoints, and be versioned when stops or road paths change.

## Data provenance and validation

- Obtain route lines from a road-network routing source with Zimbabwe coverage, or from a school-approved GPX/KML trace.
- Confirm route continuity, route-stop ordering, endpoint proximity and coordinate validity.
- Preserve source attribution and verification metadata.
- Treat routes as planning guidance, not navigation instructions, until a school has reviewed them.
- Never infer a bus's live position from its route geometry.

## Implementation boundary

This contract is not yet implemented. The current backend API has 30 methods and no route geometry field. Adding storage, generated database types and a `TransportRoute.geometry` API field changes the shared contract and must be designed with the B6 transport integration rather than silently changing the existing API during B5.

The B5 route records therefore remain valid route/stop fixtures, but **the brief's 30+ road-path coordinate requirement remains outstanding**.
