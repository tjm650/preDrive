import { StyleSheet, Text, View } from "react-native";
import { colors } from "@predrive/shared/tokens";
import { AppScreen } from "@/components/ui/app-screen";
import { ScreenHeading } from "@/components/ui/screen-heading";
import { SosEmergencyAction } from "@/components/supervisor/sos-emergency-action";
import { IncidentReportForm } from "@/components/supervisor/incident-report-form";

export default function SupervisorSafetyScreen() {
  return (
    <AppScreen contentStyle={styles.content}>
      <ScreenHeading eyebrow="SUPERVISOR" title="Safety" subtitle="Emergency response and incident records." />
      <SosEmergencyAction serviceAvailable={false} />
      <View style={styles.section}>
        <Text style={styles.heading}>Incident record</Text>
        <IncidentReportForm serviceAvailable={false} />
      </View>
      <Text style={styles.note}>If someone is in immediate danger, contact emergency services directly. This screen does not replace emergency response.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18 },
  section: { gap: 10 },
  heading: { fontSize: 18, fontWeight: "800", color: colors.ink },
  note: { fontSize: 14, lineHeight: 20, color: colors.ink, opacity: 0.68 },
});
