# preDrive route geometry contract — B6

## Current implementation state

The shared TypeScript model now defines a verified, school-scoped route geometry record in `frontend/shared/types/route-geometry.ts`, exports it from `frontend/shared/types/index.ts`, and exposes it as the optional `TransportRoute.geometry` field.

The shared model uses ordered WGS84 coordinate tuples in **[longitude, latitude]** order and includes school/route IDs, a monotonically increasing version, source and attribution, verification timestamp and verifying staff ID. `validateRouteCoordinates` rejects invalid WGS84 values, insufficient point counts and insufficient distinct points. The default minimum is 30.

Persistence and retrieval are not implemented yet. The current database and API do not contain a route geometry record, and existing demo routes must not be represented as having verified road geometry.

## Proposed storage

A route geometry record must be school-scoped and versioned:

- `school_id`: tenant scope.
- `route_id`: composite FK to the route in the same school.
- `version`: monotonically increasing geometry version.
- `geometry`: PostGIS `geography(LineString, 4326)` or equivalent GeoJSON LineString.
- `source`: routing data source.
- `attribution`: provider attribution required by the source.
- `verified_at`: timestamp of school/operator review.
- `verified_by`: school staff profile.
- `created_at` / `updated_at`.

The API serializes geometry as ordered coordinate tuples in [longitude, latitude] order. Each production route must contain at least 30 distinct road-following coordinates, begin/end at the correct route endpoints, and be versioned when stops or road paths change.

## Data provenance and validation

- Obtain route lines from a road-network routing source with Zimbabwe coverage, or from a school-approved GPX/KML trace.
- Confirm route continuity, route-stop ordering, endpoint proximity and coordinate validity.
- Preserve source attribution and verification metadata.
- Treat routes as planning guidance, not navigation instructions, until a school has reviewed them.
- Never infer a bus's live position from its route geometry.
- Never replace missing road geometry with straight lines between stops or interpolated coordinates.

## Implementation boundary

The shared type contract and basic coordinate validator are implemented. Database storage, RLS, generated database types, API retrieval, school-admin geometry review/update flow and sourced road paths remain B6 work.

No geometry has been fabricated or inserted. The three Greenfield demo routes still have stop points only; their required road paths remain outstanding until a source with Zimbabwe coverage or school-approved traces are available.
