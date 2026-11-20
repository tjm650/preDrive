import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@predrive/shared/tokens";
import { AppScreen } from "@/components/ui/app-screen";
import { ActionButton } from "@/components/ui/action-button";

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.brand}>
        <Text style={styles.name}>preDrive</Text>
        <Text style={styles.description}>School transport safety</Text>
      </View>
      <Text style={styles.title}>Every journey accounted for.</Text>
      <Text style={styles.body}>Secure school transport updates for guardians and school teams.</Text>
      <ActionButton label="Sign in" onPress={() => router.push("/signin")} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center", gap: 18 },
  brand: { gap: 4, marginBottom: 28 },
  name: { color: colors.ink, fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  description: { color: colors.ink, opacity: 0.72, fontSize: 16 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: "800" },
  body: { color: colors.ink, opacity: 0.8, fontSize: 16, lineHeight: 24, marginBottom: 10 },
});
