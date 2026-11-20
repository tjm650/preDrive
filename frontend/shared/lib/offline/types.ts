import type { EntityId, IsoDateTime } from "../../types/common";
export type ConnectivityStatus = "online" | "offline" | "unknown";
export type OfflineActionType = "child_check_on" | "child_check_off";
export type OfflineActionStatus = "queued" | "syncing" | "confirmed" | "rejected" | "needs_review";
export interface OfflineChildStatusPayload { schoolId: EntityId; tripId: EntityId; childId: EntityId; recordedAt: IsoDateTime; }
export interface OfflineQueueAction { id: string; type: OfflineActionType; payload: OfflineChildStatusPayload; status: OfflineActionStatus; attempts: number; createdAt: IsoDateTime; nextAttemptAt: IsoDateTime; lastError?: string; serverConfirmedAt?: IsoDateTime; }
export interface OfflineQueueSnapshot { version: 1; actions: OfflineQueueAction[]; updatedAt: IsoDateTime; }
