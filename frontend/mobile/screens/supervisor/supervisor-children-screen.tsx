import { StyleSheet, Text, View } from "react-native";
import { colors } from "@predrive/shared/tokens";
import { AppScreen } from "@/components/ui/app-screen";
import { ScreenHeading } from "@/components/ui/screen-heading";
import { ChildManifestList } from "@/components/supervisor/child-manifest-list";
import { HandoverVerificationPanel } from "@/components/supervisor/handover-verification-panel";

export default function SupervisorChildrenScreen() {
  return (
    <AppScreen contentStyle={styles.content}>
      <ScreenHeading eyebrow="SUPERVISOR" title="Child accountability" subtitle="Boarding, drop-off and authorised gate handovers." />
      <ChildManifestList items={[]} />
      <View style={styles.section}>
        <Text style={styles.heading}>Gate handover</Text>
        <HandoverVerificationPanel tripId={null} childId={null} collectors={[]} serviceAvailable={false} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18 },
  section: { gap: 10 },
  heading: { fontSize: 18, fontWeight: "800", color: colors.ink },
});
