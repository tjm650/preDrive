import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@predrive/shared/tokens";
import { ActionButton } from "../ui/action-button";

const REASONS = ["Traffic", "Vehicle issue", "Road closure", "Weather", "Other"] as const;
interface Props { onSubmit?: (reason: string, details: string) => Promise<void> | void; }

export function DelayReportForm({ onSubmit }: Props) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!onSubmit || !reason || submitting) return;
    setSubmitting(true);
    setError(null);
    try { await onSubmit(reason, details.trim()); }
    catch { setError("The delay report could not be sent. Your details are still here. Try again."); }
    finally { setSubmitting(false); }
  };
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Report a delay</Text>
      <Text style={styles.description}>Choose the reason and add details that help the school respond.</Text>
      <View style={styles.options}>
        {REASONS.map((item) => (
          <Text key={item} accessibilityRole="button" accessibilityState={{ selected: reason === item }} onPress={() => setReason(item)} style={[styles.option, reason === item && styles.optionSelected]}>{item}</Text>
        ))}
      </View>
      <TextInput value={details} onChangeText={setDetails} maxLength={1000} multiline placeholder="Additional details (optional)" placeholderTextColor="#647587" style={styles.input} textAlignVertical="top" />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {onSubmit ? <ActionButton label="Send delay report" onPress={submit} disabled={!reason || submitting} loading={submitting} /> : <Text style={styles.notice}>Delay reporting is unavailable until the safety service is connected.</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  description: { color: colors.ink, opacity: 0.75, fontSize: 16, lineHeight: 22 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { overflow: "hidden", borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 11, color: colors.ink, fontSize: 14, fontWeight: "600" },
  optionSelected: { backgroundColor: colors.ink, borderColor: colors.ink, color: colors.surface },
  input: { minHeight: 84, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, color: colors.ink, fontSize: 16 },
  notice: { color: colors.info, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
});
