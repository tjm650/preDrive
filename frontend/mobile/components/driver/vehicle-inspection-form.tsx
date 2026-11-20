import { useMemo, useState } from "react";
import { StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { VehicleCheckItem } from "@predrive/shared/types";
import { colors } from "@predrive/shared/tokens";
import { ActionButton } from "../ui/action-button";

const CHECKS = [
  { key: "tyres", label: "Tyres and wheel condition" },
  { key: "brakes", label: "Brakes and steering" },
  { key: "lights", label: "Headlights, indicators and brake lights" },
  { key: "windows", label: "Windscreen, mirrors and windows" },
  { key: "doors", label: "Doors, seats and seat belts" },
  { key: "emergency", label: "First-aid kit and emergency equipment" },
  { key: "fluids", label: "Oil, coolant and visible leaks" },
  { key: "cleanliness", label: "Cabin and child area clear and clean" },
] as const;

interface Props {
  onSubmit?: (items: VehicleCheckItem[], safeToOperate: boolean, notes: string) => Promise<void> | void;
}

export function VehicleInspectionForm({ onSubmit }: Props) {
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allChecked = CHECKS.every((item) => results[item.key] !== undefined);
  const safeToOperate = useMemo(() => allChecked && CHECKS.every((item) => results[item.key] === true), [allChecked, results]);
  const failedItems = CHECKS.filter((item) => results[item.key] === false);
  const submit = async () => {
    if (!onSubmit || !allChecked || submitting) return;
    setSubmitting(true);
    setError(null);
    const items: VehicleCheckItem[] = CHECKS.map((item) => ({ key: item.key, label: item.label, passed: results[item.key] === true }));
    try {
      await onSubmit(items, safeToOperate, notes.trim());
    } catch {
      setError("The inspection could not be submitted. Your entries are still here. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Vehicle inspection</Text>
      <Text style={styles.description}>Check every item before the vehicle is used.</Text>
      {CHECKS.map((item) => (
        <View key={item.key} style={styles.checkRow}>
          <View style={styles.checkCopy}>
            <Text style={styles.checkTitle}>{item.label}</Text>
            <Text style={styles.checkValue}>{results[item.key] === undefined ? "Not checked" : results[item.key] ? "Pass" : "Fail"}</Text>
          </View>
          <View style={styles.switchGroup}>
            <Text style={styles.switchLabel}>Pass</Text>
            <Switch
              value={results[item.key] === true}
              onValueChange={(value) => setResults((current) => ({ ...current, [item.key]: value }))}
              trackColor={{ false: colors.line, true: colors.success }}
              accessibilityLabel={item.label + " passed"}
            />
          </View>
          <View style={styles.switchGroup}>
            <Text style={styles.switchLabel}>Fail</Text>
            <Switch
              value={results[item.key] === false}
              onValueChange={(value) => setResults((current) => ({ ...current, [item.key]: !value }))}
              trackColor={{ false: colors.line, true: colors.danger }}
              accessibilityLabel={item.label + " failed"}
            />
          </View>
        </View>
      ))}
      <Text style={styles.label}>Additional notes</Text>
      <TextInput value={notes} onChangeText={setNotes} multiline maxLength={1000} placeholder="Describe any issue found" placeholderTextColor="#647587" style={styles.input} textAlignVertical="top" />
      {!allChecked ? <Text style={styles.notice}>Complete every check to submit this inspection.</Text> : null}
      {failedItems.length > 0 ? <Text style={styles.dangerText}>Vehicle not cleared: {failedItems.map((item) => item.label).join(", ")}. Do not begin the trip until the issue is resolved and a new inspection is recorded.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.dangerText}>{error}</Text> : null}
      {onSubmit ? <ActionButton label="Submit inspection" onPress={submit} disabled={!allChecked || submitting} loading={submitting} /> : <Text style={styles.notice}>Inspection submission is unavailable until the vehicle service is connected.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  description: { color: colors.ink, opacity: 0.75, fontSize: 16, lineHeight: 22 },
  checkRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 10, gap: 8 },
  checkCopy: { gap: 3 },
  checkTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  checkValue: { color: colors.ink, opacity: 0.7, fontSize: 14 },
  switchGroup: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  switchLabel: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  label: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  input: { minHeight: 88, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, color: colors.ink, fontSize: 16 },
  notice: { color: colors.info, fontSize: 14, lineHeight: 20 },
  dangerText: { color: colors.danger, fontSize: 14, lineHeight: 20, fontWeight: "600" },
});
