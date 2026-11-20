import type { EntityId, GeoCoordinate, SchoolOwnedRecord } from "./common";
export type BusStatus = "active" | "maintenance" | "inactive";
export type RouteStatus = "active" | "inactive";
export type TripStatus = "scheduled" | "active" | "completed" | "cancelled" | "attention_required";
export type TripDirection = "to_school" | "from_school";
export interface Bus extends SchoolOwnedRecord { registrationNumber: string; make: string; model: string; capacity: number; status: BusStatus; }
export interface RouteStop { id: EntityId; name: string; address: string; order: number; coordinate?: GeoCoordinate; }
export interface TransportRoute extends SchoolOwnedRecord { name: string; code: string; status: RouteStatus; stops: RouteStop[]; busId?: EntityId; }
export interface Trip extends SchoolOwnedRecord { routeId: EntityId; busId: EntityId; supervisorId: EntityId; driverId: EntityId; direction: TripDirection; status: TripStatus; scheduledAt: string; startedAt?: string; endedAt?: string; }
export interface BusPosition extends SchoolOwnedRecord { tripId: EntityId; coordinate: GeoCoordinate; heading?: number; speedKph?: number; recordedAt: string; }
export interface VehicleCheckItem { key: string; label: string; passed: boolean; notes?: string; }
export interface VehicleCheck extends SchoolOwnedRecord { busId: EntityId; tripId?: EntityId; checkedBy: EntityId; items: VehicleCheckItem[]; safeToOperate: boolean; checkedAt: string; }
