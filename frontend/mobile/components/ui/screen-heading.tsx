import { StyleSheet, Text, View } from "react-native";
import { colors } from "@predrive/shared/tokens";
export function ScreenHeading({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}) {
  return (
    <View style={styles.container}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 6 },
  eyebrow: {
    color: colors.ink,
    opacity: 0.72,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  title: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: "800" },
  subtitle: { color: colors.ink, opacity: 0.78, fontSize: 16, lineHeight: 23 },
});
