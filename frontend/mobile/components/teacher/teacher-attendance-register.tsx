import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { Child } from "@predrive/shared/types";
import { colors } from "@predrive/shared/tokens";
import { AppCard } from "../ui/app-card";
import { FeedbackState } from "../ui/feedback-state";

export type TeacherAttendanceStatus = "present" | "absent" | "late" | "not_recorded";
export interface TeacherAttendanceEntry {
  child: Child;
  status: TeacherAttendanceStatus;
  recordedAt?: string;
}
interface Props {
  entries: TeacherAttendanceEntry[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onUpdate?: (childId: string, status: Exclude<TeacherAttendanceStatus, "not_recorded">) => Promise<void>;
}
const statuses: { value: Exclude<TeacherAttendanceStatus, "not_recorded">; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
];
export function TeacherAttendanceRegister({ entries, loading = false, error, onRetry, onUpdate }: Props) {
  const [overrides, setOverrides] = useState<Record<string, TeacherAttendanceStatus>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  if (loading) return <FeedbackState loading title="Loading class register" description="Your assigned learner list is being retrieved." />;
  if (error) return <AppCard style={styles.stateCard}><Text style={styles.title}>Register unavailable</Text><Text style={styles.description}>{error}</Text>{onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable> : null}</AppCard>;
  if (entries.length === 0) return <FeedbackState title="No learners to display" description="Your class register will appear when the school assigns learners to your account." />;
  const update = async (childId: string, status: Exclude<TeacherAttendanceStatus, "not_recorded">) => {
    if (!onUpdate || savingId) return;
    setSavingId(childId);
    setSaveError(null);
    setSavedId(null);
    try {
      await onUpdate(childId, status);
      setOverrides((current) => ({ ...current, [childId]: status }));
      setSavedId(childId);
    } catch {
      setSaveError("Attendance could not be saved. The previous status remains unchanged. Try again.");
    } finally {
      setSavingId(null);
    }
  };
  return (
    <View style={styles.list}>
      {saveError ? <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text> : null}
      {entries.map(({ child, status: initialStatus, recordedAt }) => {
        const status = overrides[child.id] ?? initialStatus;
        const saving = savingId === child.id;
        return (
          <AppCard key={child.id} style={styles.entry}>
            <View style={styles.childHeading}>
              <View style={styles.childCopy}>
                <Text style={styles.childName}>{child.firstName} {child.lastName}</Text>
                <Text style={styles.description}>{status === "not_recorded" ? "Attendance not recorded" : statusLabel(status)}{recordedAt && !overrides[child.id] ? ` · ${recordedAt}` : ""}</Text>
              </View>
              {saving ? <ActivityIndicator color={colors.ink} /> : null}
            </View>
            <View style={styles.actions}>
              {statuses.map((option) => {
                const selected = status === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: !onUpdate || saving }}
                    disabled={!onUpdate || saving}
                    onPress={() => void update(child.id, option.value)}
                    style={[styles.statusButton, selected && styles.statusSelected, !onUpdate && styles.disabled]}
                  >
                    <Text style={[styles.statusText, selected && styles.statusTextSelected]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {savedId === child.id ? <Text accessibilityRole="status" style={styles.saved}>Attendance updated.</Text> : null}
            {!onUpdate ? <Text style={styles.notice}>Attendance entry will be enabled when the school service is connected.</Text> : null}
          </AppCard>
        );
      })}
    </View>
  );
}
function statusLabel(status: TeacherAttendanceStatus): string {
  if (status === "present") return "Present";
  if (status === "absent") return "Absent";
  if (status === "late") return "Late";
  return "Not recorded";
}
const styles = StyleSheet.create({
  list: { gap: 12 },
  stateCard: { padding: 16, gap: 8 },
  title: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  description: { color: colors.ink, opacity: 0.7, fontSize: 14, lineHeight: 20 },
  retry: { minHeight: 44, justifyContent: "center" },
  retryText: { color: colors.info, fontSize: 15, fontWeight: "800" },
  entry: { padding: 14, gap: 12 },
  childHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  childCopy: { flex: 1, gap: 3 },
  childName: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusButton: { minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  statusSelected: { borderColor: colors.ink, backgroundColor: colors.ink },
  statusText: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  statusTextSelected: { color: colors.surface },
  disabled: { opacity: 0.55 },
  notice: { color: colors.warning, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  saved: { color: colors.success, fontSize: 13, fontWeight: "700" },
});
