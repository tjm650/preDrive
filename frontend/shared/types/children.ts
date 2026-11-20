import type { EntityId, SchoolOwnedRecord } from "./common";
export type ChildStatus = "active" | "inactive" | "withdrawn";
export type ChildTripStatus = "not_boarded" | "on_board" | "dropped_off" | "absent";
export type CollectorRelationship = "parent" | "guardian" | "relative" | "authorised_caregiver" | "other";
export interface ClassGroup extends SchoolOwnedRecord { name: string; ageRangeLabel: string; active: boolean; }
export interface Child extends SchoolOwnedRecord { firstName: string; lastName: string; dateOfBirth: string; classGroupId: EntityId; status: ChildStatus; profileImage?: string; }
export interface GuardianChildRelationship extends SchoolOwnedRecord { guardianUserId: EntityId; childId: EntityId; relationship: CollectorRelationship; primaryContact: boolean; }
export interface ApprovedCollector extends SchoolOwnedRecord { childId: EntityId; fullName: string; relationship: CollectorRelationship; phone: string; active: boolean; }
export interface ChildTripRecord extends SchoolOwnedRecord { tripId: EntityId; childId: EntityId; status: ChildTripStatus; recordedAt?: string; recordedBy?: EntityId; confirmationPending: boolean; }
