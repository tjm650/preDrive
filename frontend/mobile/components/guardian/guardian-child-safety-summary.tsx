import { StyleSheet, Text, View } from "react-native";
import type { ApprovedCollector, Child } from "@predrive/shared/types";
import { colors } from "@predrive/shared/tokens";
import { AppCard } from "../ui/app-card";

interface Props { child: Child; collectors: ApprovedCollector[]; }
export function GuardianChildSafetySummary({ child, collectors }: Props) {
  const activeCollectors = collectors.filter((collector) => collector.active);
  return (
    <AppCard style={styles.card}>
      <Text style={styles.title}>Collection permissions</Text>
      <Text style={styles.childName}>{child.firstName} {child.lastName}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Approved collectors</Text>
        <Text style={styles.value}>{activeCollectors.length}</Text>
      </View>
      {activeCollectors.length === 0 ? (
        <Text style={styles.notice}>No active approved collectors are listed. Contact your school before arranging collection by another adult.</Text>
      ) : activeCollectors.map((collector) => (
        <View key={collector.id} style={styles.collector}>
          <View style={styles.collectorCopy}>
            <Text style={styles.name}>{collector.fullName}</Text>
            <Text style={styles.meta}>{collector.relationship.replaceAll("_", " ")}</Text>
          </View>
          <Text style={styles.approved}>Approved</Text>
        </View>
      ))}
      <Text style={styles.footnote}>A receiving adult must still complete the school's PIN handover check at the gate.</Text>
    </AppCard>
  );
}
const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  title: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  childName: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  label: { color: colors.ink, opacity: 0.72, fontSize: 14 },
  value: { color: colors.ink, fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },
  collector: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  collectorCopy: { flex: 1, gap: 3 },
  name: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  meta: { color: colors.ink, opacity: 0.7, fontSize: 13, textTransform: "capitalize" },
  approved: { color: colors.success, fontSize: 13, fontWeight: "800" },
  notice: { color: colors.warning, fontSize: 14, lineHeight: 20 },
  footnote: { color: colors.ink, opacity: 0.7, fontSize: 13, lineHeight: 18 },
});
