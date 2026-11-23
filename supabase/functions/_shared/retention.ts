import {
  DATA_EXPORT_TTL_DAYS,
  GPS_HISTORY_TTL_DAYS,
  RETENTION_BATCH_SIZE,
  TERMINAL_DELIVERY_TTL_DAYS,
  isValidDataExportObjectPath,
  legacyDataExportObjectPath,
} from "./privacy.ts";
import type { ServiceClient } from "./supabase.ts";

export function retentionCutoff(days: number, now: Date): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export interface RetentionResult {
  gpsHistoryDeleted: number;
  terminalDeliveriesDeleted: number;
  exportFilesDeleted: number;
  exportFilesFailed: number;
}

export async function runApprovedRetention(
  client: ServiceClient,
  now = new Date(),
): Promise<RetentionResult> {
  const result: RetentionResult = {
    gpsHistoryDeleted: 0,
    terminalDeliveriesDeleted: 0,
    exportFilesDeleted: 0,
    exportFilesFailed: 0,
  };

  const gpsCutoff = retentionCutoff(GPS_HISTORY_TTL_DAYS, now);
  const { data: oldPositions, error: gpsSelectError } = await client
    .from("bus_position_history")
    .select("id")
    .lt("recorded_at", gpsCutoff)
    .order("recorded_at", { ascending: true })
    .limit(RETENTION_BATCH_SIZE);

  if (gpsSelectError) throw gpsSelectError;
  const gpsIds = (oldPositions ?? []).map((row) => row.id);
  if (gpsIds.length) {
    const { error } = await client
      .from("bus_position_history")
      .delete()
      .in("id", gpsIds);
    if (error) throw error;
    result.gpsHistoryDeleted = gpsIds.length;
  }

  const deliveryCutoff = retentionCutoff(TERMINAL_DELIVERY_TTL_DAYS, now);
  const { data: oldDeliveries, error: deliverySelectError } = await client
    .from("notification_deliveries")
    .select("id")
    .in("status", ["sent", "failed", "suppressed"])
    .lt("updated_at", deliveryCutoff)
    .order("updated_at", { ascending: true })
    .limit(RETENTION_BATCH_SIZE);

  if (deliverySelectError) throw deliverySelectError;
  const deliveryIds = (oldDeliveries ?? []).map((row) => row.id);
  if (deliveryIds.length) {
    const { error } = await client
      .from("notification_deliveries")
      .delete()
      .in("id", deliveryIds);
    if (error) throw error;
    result.terminalDeliveriesDeleted = deliveryIds.length;
  }

  const exportCutoff = retentionCutoff(DATA_EXPORT_TTL_DAYS, now);
  const { data: expiredExports, error: exportSelectError } = await client
    .from("deletion_requests")
    .select("id,school_id,export_object_path")
    .eq("request_type", "data_export")
    .eq("status", "completed")
    .eq("retention_hold", false)
    .lt("completed_at", exportCutoff)
    .order("completed_at", { ascending: true })
    .limit(RETENTION_BATCH_SIZE);

  if (exportSelectError) throw exportSelectError;

  for (const item of expiredExports ?? []) {
    const path = item.export_object_path ??
      legacyDataExportObjectPath(item.school_id, item.id);
    if (
      item.export_object_path !== null &&
      !isValidDataExportObjectPath(item.school_id, item.id, path)
    ) {
      result.exportFilesFailed += 1;
      continue;
    }
    const { error } = await client.storage.from("exports").remove([path]);
    if (error) {
      result.exportFilesFailed += 1;
      continue;
    }
    result.exportFilesDeleted += 1;
  }

  return result;
}
