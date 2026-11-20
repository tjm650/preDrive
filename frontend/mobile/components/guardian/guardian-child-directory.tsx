import { StyleSheet, Text, View } from "react-native";
import type { Child, ChildTripStatus } from "@predrive/shared/types";
import { colors } from "@predrive/shared/tokens";
import { AppCard } from "../ui/app-card";
import { GuardianChildCard } from "./guardian-child-card";

interface Props {
  children: Child[];
  classGroupNames: Record<string, string>;
  tripStatuses?: Record<string, ChildTripStatus>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function GuardianChildDirectory({
  children, classGroupNames, tripStatuses = {}, loading = false, error, onRetry,
}: Props) {
  if (loading) return <AppCard style={styles.state}><Text style={styles.stateTitle}>Loading child profiles</Text><Text style={styles.body}>Retrieving children linked to your guardian account.</Text></AppCard>;
  if (error) return <AppCard style={styles.state}><Text style={styles.stateTitle}>Child profiles could not load</Text><Text style={styles.body}>{error}</Text>{onRetry ? <Text accessibilityRole="button" onPress={onRetry} style={styles.retry}>Try again</Text> : null}</AppCard>;
  if (children.length === 0) return <AppCard style={styles.state}><Text style={styles.stateTitle}>No linked children</Text><Text style={styles.body}>If you believe a child should be listed, contact your school administrator to check the guardian link.</Text></AppCard>;
  return (
    <View style={styles.list}>
      {children.map((child) => (
        <GuardianChildCard
          key={child.id}
          child={child}
          classNameLabel={classGroupNames[child.classGroupId] ?? "Class not available"}
          tripStatus={tripStatuses[child.id] ?? "not_boarded"}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  state: { padding: 18, minHeight: 128, justifyContent: "center", gap: 8 },
  stateTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  body: { color: colors.ink, opacity: 0.72, fontSize: 15, lineHeight: 21 },
  retry: { color: colors.info, fontSize: 15, fontWeight: "800", paddingVertical: 10 },
});
