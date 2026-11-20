import { StyleSheet, Text } from "react-native";
import { colors } from "@predrive/shared/tokens";
import { AppCard } from "../ui/app-card";

export function TeacherSafetyGuidance() {
  return (
    <AppCard style={styles.card}>
      <Text style={styles.title}>Child safety comes first</Text>
      <Text style={styles.body}>For an injury, illness or safeguarding concern, follow your school's safeguarding procedure and contact school leadership immediately.</Text>
      <Text style={styles.notice}>Digital incident reporting is not connected yet. Do not use this screen as an emergency reporting channel.</Text>
    </AppCard>
  );
}
const styles = StyleSheet.create({
  card: { padding: 16, gap: 10 },
  title: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  notice: { color: colors.warning, fontSize: 14, lineHeight: 20 },
});
