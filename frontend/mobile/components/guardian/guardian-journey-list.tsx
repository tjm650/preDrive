import { StyleSheet, Text, View } from "react-native";
import type { Trip } from "@predrive/shared/types";
import { colors } from "@predrive/shared/tokens";
import { AppCard } from "../ui/app-card";

interface JourneyItem { trip: Trip; routeName: string; busRegistration: string; }
interface Props { journeys: JourneyItem[]; loading?: boolean; error?: string | null; onRetry?: () => void; }

export function GuardianJourneyList({ journeys, loading = false, error, onRetry }: Props) {
  if (loading) return <AppCard style={styles.state}><Text style={styles.stateTitle}>Loading journeys</Text><Text style={styles.body}>Checking your latest school transport updates.</Text></AppCard>;
  if (error) return <AppCard style={styles.state}><Text style={styles.stateTitle}>Journeys could not load</Text><Text style={styles.body}>{error}</Text>{onRetry ? <Text accessibilityRole="button" onPress={onRetry} style={styles.retry}>Try again</Text> : null}</AppCard>;
  if (journeys.length === 0) return <AppCard style={styles.state}><Text style={styles.stateTitle}>No recent journeys</Text><Text style={styles.body}>Completed and scheduled journeys will appear here.</Text></AppCard>;
  return <View style={styles.list}>{journeys.map(({ trip, routeName, busRegistration }) => (
    <AppCard key={trip.id} style={styles.item}>
      <View style={styles.row}><Text style={styles.route}>{routeName}</Text><Text style={styles.status}>{trip.status.replace("_", " ")}</Text></View>
      <Text style={styles.body}>Bus {busRegistration}</Text>
      <Text style={styles.body}>{trip.direction === "to_school" ? "To school" : "From school"} · {new Date(trip.scheduledAt).toLocaleString()}</Text>
    </AppCard>
  ))}</View>;
}
const styles = StyleSheet.create({
  list: { gap: 12 }, item: { padding: 16, gap: 8 }, state: { padding: 18, gap: 8, minHeight: 120, justifyContent: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  route: { color: colors.ink, fontSize: 17, fontWeight: "800", flex: 1 },
  status: { color: colors.info, fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
  stateTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  body: { color: colors.ink, opacity: 0.72, fontSize: 15, lineHeight: 21 },
  retry: { color: colors.info, fontSize: 15, fontWeight: "800", paddingVertical: 10 },
});
