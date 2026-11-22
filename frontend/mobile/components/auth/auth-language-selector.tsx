import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LanguageCode } from "@predrive/shared/types";
import { colors } from "@predrive/shared/tokens";
const options: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "English" },
//   { code: "sn", label: "Shona" },
//   { code: "nd", label: "Ndebele" },
];
export function AuthLanguageSelector({
  value,
  onChange,
  label,
}: {
  value: LanguageCode;
  onChange: (v: LanguageCode) => void;
  label: string;
}) {
  return (
    <View style={s.container}>
      <Text style={s.label}>{label}</Text>
      <View accessibilityRole="radiogroup" style={s.options}>
        {options.map((o) => {
          const selected = o.code === value;
          return (
            <Pressable
              key={o.code}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(o.code)}
              style={[s.option, selected ? s.selected : undefined]}
            >
              <Text style={[s.optionText, selected ? s.selectedText : undefined]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  container: { gap: 8 },
  label: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.ink, backgroundColor: colors.ink },
  optionText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  selectedText: { color: colors.surface },
});
