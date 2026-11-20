import { StyleSheet, Text, View } from "react-native";
import type { BusPosition, RouteStop, TransportRoute, Trip } from "@predrive/shared/types";
import { colors } from "@predrive/shared/tokens";
import { AppCard } from "../ui/app-card";

export type GuardianConnectivity = "online" | "offline" | "reconnecting";
export type ArrivalRadius = 500 | 1000 | 2000;

interface Props {
  trip: Trip | null;
  route: TransportRoute | null;
  position?: BusPosition | null;
  nextStop?: RouteStop | null;
  etaMinutes?: number | null;
  lastUpdatedAt?: string | null;
  connectivity: GuardianConnectivity;
  arrivalRadius: ArrivalRadius;
  onArrivalRadiusChange?: (radius: ArrivalRadius) => void;
}

const RADIUS_OPTIONS: ArrivalRadius[] = [500, 1000, 2000];

export function GuardianLiveJourneyPanel({
  trip, route, position, nextStop, etaMinutes, lastUpdatedAt,
  connectivity, arrivalRadius, onArrivalRadiusChange,
}: Props) {
  const active = trip?.status === "active";
  const updatedLabel = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <View style={styles.container}>
      <View style={[styles.connection, connectivity === "online" ? styles.online : connectivity === "offline" ? styles.offline : styles.reconnecting]}>
        <View style={[styles.dot, connectivity === "online" ? styles.onlineDot : styles.offlineDot]} />
        <Text style={styles.connectionText}>{connectivity === "online" ? "Live updates connected" : connectivity === "offline" ? "You're offline · Showing last confirmed update" : "Reconnecting · Updates may be delayed"}</Text>
      </View>
      {!trip || !route ? (
        <AppCard style={styles.card}>
          <Text style={styles.title}>No journey to track</Text>
          <Text style={styles.body}>A bus journey will appear here when your school starts a trip for a linked child.</Text>
        </AppCard>
      ) : (
        <AppCard style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.eyebrow}>{trip.direction === "to_school" ? "TO SCHOOL" : "FROM SCHOOL"}</Text>
            <Text style={[styles.status, active ? styles.active : styles.inactive]}>{trip.status.replace("_", " ")}</Text>
          </View>
          <Text style={styles.title}>{route.name}</Text>
          {active ? (
            <>
              <View style={styles.mapSurface}>
                <View style={styles.mapIcon}><Text style={styles.mapIconText}>LIVE</Text></View>
                <Text style={styles.mapTitle}>{position ? "Bus location received" : "Waiting for bus location"}</Text>
                <Text style={styles.mapBody}>The live map will display verified trip locations when the map service is connected.</Text>
              </View>
              <View style={styles.etaBlock}>
                <Text style={styles.etaValue}>{etaMinutes == null ? "—" : etaMinutes <= 1 ? "Arriving" : `~${etaMinutes} min`}</Text>
                <Text style={styles.body}>Estimated arrival</Text>
              </View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Next stop</Text><Text style={styles.detailValue}>{nextStop?.name ?? "Awaiting update"}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Last update</Text><Text style={styles.detailValue}>{updatedLabel ?? "Not received"}</Text></View>
            </>
          ) : (
            <Text style={styles.body}>This journey is {trip.status.replace("_", " ")}. Live location is not being shared.</Text>
          )}
        </AppCard>
      )}
      <AppCard style={styles.radiusCard}>
        <Text style={styles.radiusTitle}>Arrival alert distance</Text>
        <Text style={styles.body}>Choose when you want to be notified as the bus approaches.</Text>
        <View style={styles.radiusOptions}>
          {RADIUS_OPTIONS.map((radius) => (
            <Text key={radius} accessibilityRole="button" accessibilityState={{ selected: arrivalRadius === radius, disabled: !onArrivalRadiusChange }} onPress={() => onArrivalRadiusChange?.(radius)} style={[styles.radiusOption, arrivalRadius === radius && styles.radiusSelected, !onArrivalRadiusChange && styles.disabled]}>
              {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}
            </Text>
          ))}
        </View>
        {!onArrivalRadiusChange ? <Text style={styles.helper}>Alert preferences will be available when guardian settings are connected.</Text> : null}
      </AppCard>
      <Text style={styles.privacy}>Bus location is shared only while a trip is active.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  connection: { minHeight: 42, borderRadius: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  online: { backgroundColor: "#E8F4ED" }, offline: { backgroundColor: "#FBEAEA" }, reconnecting: { backgroundColor: "#FFF4D8" },
  dot: { width: 8, height: 8, borderRadius: 4 }, onlineDot: { backgroundColor: colors.success }, offlineDot: { backgroundColor: colors.danger },
  connectionText: { color: colors.ink, fontSize: 14, fontWeight: "700", flex: 1 },
  card: { padding: 16, gap: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { color: colors.ink, opacity: 0.65, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  status: { color: colors.ink, fontSize: 12, fontWeight: "700", textTransform: "capitalize", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: "hidden" },
  active: { backgroundColor: "#E8F4ED" }, inactive: { backgroundColor: colors.canvas },
  title: { color: colors.ink, fontSize: 21, fontWeight: "800" },
  body: { color: colors.ink, opacity: 0.75, fontSize: 16, lineHeight: 22 },
  mapSurface: { minHeight: 164, backgroundColor: colors.canvas, borderRadius: 10, alignItems: "center", justifyContent: "center", padding: 18, gap: 8, borderWidth: 1, borderColor: colors.line },
  mapIcon: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  mapIconText: { color: colors.surface, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  mapTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  mapBody: { color: colors.ink, opacity: 0.7, textAlign: "center", fontSize: 14, lineHeight: 20 },
  etaBlock: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, gap: 2 },
  etaValue: { color: colors.ink, fontSize: 32, fontWeight: "800", fontVariant: ["tabular-nums"] },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  detailLabel: { color: colors.ink, opacity: 0.65, fontSize: 14 },
  detailValue: { color: colors.ink, fontSize: 14, fontWeight: "700", flexShrink: 1, textAlign: "right" },
  radiusCard: { padding: 16, gap: 12 },
  radiusTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  radiusOptions: { flexDirection: "row", gap: 8 },
  radiusOption: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 999, alignItems: "center", justifyContent: "center", textAlign: "center", textAlignVertical: "center", overflow: "hidden", color: colors.ink, fontSize: 14, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 10 },
  radiusSelected: { backgroundColor: colors.ink, borderColor: colors.ink, color: colors.surface },
  disabled: { opacity: 0.8 },
  helper: { color: colors.ink, opacity: 0.65, fontSize: 13, lineHeight: 18 },
  privacy: { color: colors.success, fontSize: 14, fontWeight: "700", textAlign: "center" },
});
