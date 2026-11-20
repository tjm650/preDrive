import type { OfflineQueueAction, OfflineQueueSnapshot } from "./types";
export const MAX_SYNC_ATTEMPTS = 8;
export const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;
export function sortOfflineActions(actions: OfflineQueueAction[]): OfflineQueueAction[] {
  return [...actions].sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
export function createOfflineQueueSnapshot(actions: OfflineQueueAction[], now = new Date().toISOString()): OfflineQueueSnapshot {
  return {version:1,actions:sortOfflineActions(actions),updatedAt:now};
}
export function getRetryDelayMs(attempts: number): number {
  return Math.min(2000 * 2 ** Math.max(0,Math.floor(attempts)),MAX_RETRY_DELAY_MS);
}
export function isActionReadyForSync(action: OfflineQueueAction, now = Date.now()): boolean {
  return action.status === "queued" && action.attempts < MAX_SYNC_ATTEMPTS && Date.parse(action.nextAttemptAt) <= now;
}
