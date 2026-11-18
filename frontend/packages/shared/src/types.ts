export type UserRole = 'parent' | 'supervisor' | 'school_admin' | 'platform_owner';
export type RouteType = 'pickup' | 'dropoff';
export type TripStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type TripEventType = 'boarded' | 'arrived_school' | 'dropped_home' | 'absent' | 'sos' | 'delay' | 'handover_rejected';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
import type { Coordinates } from './geo';
export interface TripManifestChild { childId: string; firstName: string; stopId: string | null; homeStop: Coordinates | null; homeRadiusMetres: number }
export interface ActiveTripLocation extends Coordinates { tripId: string; heading: number | null; speedKmh: number | null; updatedAt: string }
