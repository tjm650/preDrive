import type { EntityId, IsoDateTime, LanguageCode, SchoolOwnedRecord, TimestampedRecord } from "./common";
export type UserRole = "school_admin" | "guardian" | "supervisor" | "driver" | "teacher";
export type SchoolStatus = "pending" | "active" | "suspended";
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";
export interface School extends TimestampedRecord { name: string; status: SchoolStatus; address: string; timezone: "Africa/Harare"; indicativeZigPerUsd: number; }
export interface UserProfile extends TimestampedRecord { authUserId: EntityId; fullName: string; email: string; phone?: string; language: LanguageCode; }
export interface SchoolMembership extends SchoolOwnedRecord { userId: EntityId; role: UserRole; active: boolean; }
export interface StaffMember extends SchoolOwnedRecord { userId: EntityId; fullName: string; role: "supervisor" | "driver" | "teacher"; phone: string; active: boolean; }
export interface SchoolInvitation extends SchoolOwnedRecord { email: string; role: UserRole; status: InvitationStatus; expiresAt: IsoDateTime; }
