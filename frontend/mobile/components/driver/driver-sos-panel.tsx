import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { colors } from "@predrive/shared/tokens";
import { ActionButton } from "../ui/action-button";
interface Props { onRaiseSos?: () => Promise<void> | void; }
export function DriverSosPanel({ onRaiseSos }: Props) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const raise = () => {
    if (!onRaiseSos || sending) return;
    Alert.alert("Send emergency alert?", "The school safety team will be notified when the emergency service is connected.", [
      { text: "Cancel", style: "cancel" },
      { text: "Send SOS", style: "destructive", onPress: async () => {
        setSending(true); setError(null);
        try { await onRaiseSos(); }
        catch { setError("SOS could not be sent. Contact the school directly and call emergency services if anyone is in immediate danger."); }
        finally { setSending(false); }
      }},
    ]);
  };
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Emergency SOS</Text>
      <Text style={styles.description}>Use this for an immediate safety emergency. If anyone is in immediate danger, contact emergency services directly as well.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {onRaiseSos ? <ActionButton label="Raise SOS" variant="danger" onPress={raise} loading={sending} disabled={sending} /> : <Text style={styles.notice}>SOS delivery is unavailable until the safety service is connected. Contact the school directly in an emergency.</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.danger, borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  title: { color: colors.danger, fontSize: 20, fontWeight: "800" },
  description: { color: colors.ink, fontSize: 16, lineHeight: 23 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  notice: { color: colors.ink, opacity: 0.75, fontSize: 14, lineHeight: 20 },
});
