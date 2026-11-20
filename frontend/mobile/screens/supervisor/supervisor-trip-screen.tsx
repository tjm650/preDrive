import { StyleSheet, Text, View } from "react-native";
import { colors } from "@predrive/shared/tokens";
import { AppScreen } from "@/components/ui/app-screen";
import { ScreenHeading } from "@/components/ui/screen-heading";
import { TripControlCard } from "@/components/supervisor/trip-control-card";
import { ChildManifestList } from "@/components/supervisor/child-manifest-list";

export default function SupervisorTripScreen() {
  return (
    <AppScreen contentStyle={styles.content}>
      <ScreenHeading eyebrow="SUPERVISOR" title="Trip operations" subtitle="Trip status and child accountability." />
      <TripControlCard trip={null} />
      <View style={styles.section}>
        <Text style={styles.heading}>Child manifest</Text>
        <ChildManifestList items={[]} />
      </View>
      <Text style={styles.note}>Boarding and drop-off records must be confirmed by the school service. Offline records must remain visibly pending until the server confirms them.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18 },
  section: { gap: 10 },
  heading: { fontSize: 18, fontWeight: "800", color: colors.ink },
  note: { fontSize: 14, lineHeight: 20, color: colors.ink, opacity: 0.65 },
});
