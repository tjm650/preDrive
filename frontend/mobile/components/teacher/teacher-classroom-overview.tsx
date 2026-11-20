import { StyleSheet, Text, View } from "react-native";
import type { ClassGroup, StaffMember } from "@predrive/shared/types";
import { colors } from "@predrive/shared/tokens";
import { AppCard } from "../ui/app-card";

interface Props {
  classGroup: ClassGroup | null;
  teacher: StaffMember | null;
  activeLearnerCount?: number;
  attendanceRecordedCount?: number;
}
export function TeacherClassroomOverview({ classGroup, teacher, activeLearnerCount, attendanceRecordedCount }: Props) {
  if (!classGroup || !teacher) {
    return (
      <AppCard style={styles.card}>
        <Text style={styles.title}>Classroom assignment unavailable</Text>
        <Text style={styles.description}>Your assigned class and learner register will appear after your school account is connected.</Text>
      </AppCard>
    );
  }
  const attendanceLabel = typeof attendanceRecordedCount === "number" && typeof activeLearnerCount === "number"
    ? `${attendanceRecordedCount} of ${activeLearnerCount} attendance records completed`
    : "Attendance totals have not loaded";
  return (
    <AppCard style={styles.card}>
      <Text style={styles.eyebrow}>YOUR CLASS</Text>
      <Text style={styles.title}>{classGroup.name}</Text>
      <Text style={styles.description}>{classGroup.ageRangeLabel}</Text>
      <View style={styles.divider} />
      <Text style={styles.label}>Teacher</Text>
      <Text style={styles.value}>{teacher.fullName}</Text>
      <Text style={styles.label}>Class register</Text>
      <Text style={styles.value}>{typeof activeLearnerCount === "number" ? activeLearnerCount : "—"} learners</Text>
      <Text style={styles.description}>{attendanceLabel}</Text>
    </AppCard>
  );
}
const styles = StyleSheet.create({
  card: { padding: 16, gap: 8 },
  eyebrow: { color: colors.info, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  title: { color: colors.ink, fontSize: 21, fontWeight: "800" },
  description: { color: colors.ink, opacity: 0.72, fontSize: 14, lineHeight: 20 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 5 },
  label: { color: colors.ink, opacity: 0.68, fontSize: 13, fontWeight: "700" },
  value: { color: colors.ink, fontSize: 16, fontWeight: "700" },
});
