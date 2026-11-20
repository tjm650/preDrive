import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PaymentMethod } from "@predrive/shared/types";
import { colors } from "@predrive/shared/tokens";

const METHODS: { value: Exclude<PaymentMethod, "card">; label: string; detail: string }[] = [
  { value: "ecocash", label: "EcoCash", detail: "Mobile money" },
  { value: "cbz_transfer", label: "CBZ", detail: "Bank transfer" },
  { value: "cabs_transfer", label: "CABS", detail: "Bank transfer" },
];

interface Props { value: Exclude<PaymentMethod, "card">; onChange: (method: Exclude<PaymentMethod, "card">) => void; disabled?: boolean; }
export function GuardianPaymentMethodSelector({ value, onChange, disabled = false }: Props) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup">
      {METHODS.map((method) => {
        const selected = value === method.value;
        return (
          <Pressable
            key={method.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(method.value)}
            style={({ pressed }) => [styles.option, selected && styles.selected, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.dot} /> : null}</View>
            <View style={styles.copy}>
              <Text style={styles.label}>{method.label}</Text>
              <Text style={styles.detail}>{method.detail}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  group: { gap: 8 },
  option: { minHeight: 58, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface },
  selected: { borderColor: colors.ink, backgroundColor: colors.canvas },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: colors.ink },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
  copy: { flex: 1, gap: 2 },
  label: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  detail: { color: colors.ink, opacity: 0.68, fontSize: 14 },
});
