import { Pressable, StyleSheet, Text, View } from "react-native";
import type { School, UserProfile } from "@predrive/shared/types";
import { colors } from "@predrive/shared/tokens";
import { AppCard } from "../ui/app-card";

export interface GuardianNotificationPreferences {
  journeyUpdates: boolean;
  feeReminders: boolean;
  schoolAnnouncements: boolean;
}
interface AccountProps {
  profile: UserProfile | null;
  school: School | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSignOut?: () => void;
}
export function GuardianAccountSummary({ profile, school, loading = false, error, onRetry, onSignOut }: AccountProps) {
  if (loading) return <AppCard style={styles.card}><Text style={styles.title}>Loading account</Text><Text style={styles.body}>Your account details are being retrieved.</Text></AppCard>;
  if (error) return <AppCard style={styles.card}><Text style={styles.title}>Account details unavailable</Text><Text style={styles.body}>{error}</Text>{onRetry ? <Text accessibilityRole="button" onPress={onRetry} style={styles.action}>Try again</Text> : null}</AppCard>;
  if (!profile) return <AppCard style={styles.card}><Text style={styles.title}>Account not connected</Text><Text style={styles.body}>Your verified profile and school membership will appear after secure sign-in is connected.</Text></AppCard>;
  return (
    <AppCard style={styles.card}>
      <View style={styles.avatar}><Text style={styles.initials}>{profile.fullName.trim().split(/\\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")}</Text></View>
      <Text style={styles.name}>{profile.fullName}</Text>
      <Text selectable style={styles.body}>{profile.email}</Text>
      {profile.phone ? <Text selectable style={styles.body}>{profile.phone}</Text> : null}
      <View style={styles.separator} />
      <Text style={styles.fieldLabel}>School</Text>
      <Text style={styles.fieldValue}>{school?.name ?? "School membership unavailable"}</Text>
      {school?.address ? <Text style={styles.body}>{school.address}</Text> : null}
      {onSignOut ? <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable> : null}
    </AppCard>
  );
}

interface PreferenceProps {
  preferences: GuardianNotificationPreferences | null;
  onChange?: (key: keyof GuardianNotificationPreferences, enabled: boolean) => void;
}
const PREFERENCE_ROWS: { key: keyof GuardianNotificationPreferences; title: string; description: string }[] = [
  { key: "journeyUpdates", title: "Journey updates", description: "Trip start, arrival estimates and journey completion" },
  { key: "feeReminders", title: "Fee reminders", description: "Invoice due dates and outstanding balances" },
  { key: "schoolAnnouncements", title: "School announcements", description: "Updates and notices from your school" },
];
export function GuardianNotificationSettings({ preferences, onChange }: PreferenceProps) {
  return (
    <AppCard style={styles.card}>
      <Text style={styles.title}>Notification preferences</Text>
      {PREFERENCE_ROWS.map((row) => {
        const enabled = preferences?.[row.key] ?? false;
        const available = preferences !== null && onChange !== undefined;
        return (
          <View key={row.key} style={styles.preferenceRow}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.fieldValue}>{row.title}</Text>
              <Text style={styles.body}>{row.description}</Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={row.title}
              accessibilityState={{ checked: enabled, disabled: !available }}
              disabled={!available}
              onPress={() => onChange?.(row.key, !enabled)}
              style={[styles.switch, enabled && styles.switchOn, !available && styles.switchDisabled]}
            >
              <View style={[styles.switchThumb, enabled && styles.switchThumbOn]} />
            </Pressable>
          </View>
        );
      })}
      <View style={styles.separator} />
      <View style={styles.preferenceRow}>
        <View style={styles.preferenceCopy}>
          <Text style={styles.fieldValue}>Safety alerts</Text>
          <Text style={styles.body}>Urgent child-safety and emergency alerts</Text>
        </View>
        <Text style={styles.required}>Always on</Text>
      </View>
      {!preferences || !onChange ? <Text style={styles.notice}>Notification settings will be available when your account service is connected.</Text> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  initials: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  name: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  body: { color: colors.ink, opacity: 0.7, fontSize: 14, lineHeight: 20 },
  separator: { height: 1, backgroundColor: colors.line, marginVertical: 2 },
  fieldLabel: { color: colors.ink, opacity: 0.7, fontSize: 13, fontWeight: "700" },
  fieldValue: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  action: { color: colors.info, fontSize: 15, fontWeight: "800", paddingVertical: 8 },
  signOut: { minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 999, alignItems: "center", justifyContent: "center", marginTop: 4 },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: "800" },
  preferenceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  preferenceCopy: { flex: 1, gap: 3 },
  switch: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.line, padding: 3, justifyContent: "center" },
  switchOn: { backgroundColor: colors.success },
  switchDisabled: { opacity: 0.5 },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface },
  switchThumbOn: { alignSelf: "flex-end" },
  required: { color: colors.success, fontSize: 13, fontWeight: "800" },
  notice: { color: colors.warning, fontSize: 13, lineHeight: 19 },
});
