import { StyleSheet, Text, View } from "react-native";
import type { TransportRoute, Trip } from "@predrive/shared/types";
import { colors } from "@predrive/shared/tokens";

interface Props { route: TransportRoute | null; trip: Trip | null; }
export function DriverRouteOverview({ route, trip }: Props) {
  if (!route || !trip) return (
    <View style={styles.card}>
      <Text style={styles.title}>Assigned route</Text>
      <Text style={styles.emptyTitle}>Route information unavailable</Text>
      <Text style={styles.body}>Your assigned route and active trip will appear here after secure sign-in and transport data are connected.</Text>
    </View>
  );
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>ASSIGNED ROUTE</Text>
      <Text style={styles.title}>{route.name}</Text>
      <Text style={styles.body}>{trip.direction === "to_school" ? "To school" : "From school"} · {trip.status.replace("_", " ")}</Text>
      <View style={styles.divider} />
      {route.stops.slice().sort((a, b) => a.order - b.order).map((stop, index) => (
        <View key={stop.id} style={styles.stop}>
          <View style={styles.stopMarker}><Text style={styles.stopNumber}>{index + 1}</Text></View>
          <View style={styles.stopCopy}><Text style={styles.stopName}>{stop.name}</Text><Text style={styles.stopAddress}>{stop.address}</Text></View>
        </View>
      ))}
      <Text style={styles.privacy}>Location sharing is active only during an active trip.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  eyebrow: { color: colors.ink, opacity: 0.65, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  title: { color: colors.ink, fontSize: 21, fontWeight: "800" },
  body: { color: colors.ink, opacity: 0.75, fontSize: 16, lineHeight: 22 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.line },
  stop: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 5 },
  stopMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  stopNumber: { color: colors.ink, fontWeight: "800", fontSize: 13 },
  stopCopy: { flex: 1, gap: 3 },
  stopName: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  stopAddress: { color: colors.ink, opacity: 0.7, fontSize: 14 },
  privacy: { color: colors.success, fontSize: 14, fontWeight: "700" },
});
