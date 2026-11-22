import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { LanguageCode } from "@predrive/shared/types";
import { colors } from "@predrive/shared/tokens";
import { AppScreen } from "@/components/ui/app-screen";
import { ScreenHeading } from "@/components/ui/screen-heading";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getMobileAuthCopy } from "@/components/auth/auth-copy";
import { AuthLanguageSelector } from "@/components/auth/auth-language-selector";

export default function SignInScreen() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const copy = getMobileAuthCopy(language);
  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.brand}>
        <Text style={styles.brandName}>preDrive</Text>
        {/* <Text style={styles.brandDescription}>{copy.brandDescription}</Text> */}
      </View>
      {/* <AuthLanguageSelector label={copy.languageLabel} value={language} onChange={setLanguage} /> */}
      {/* <ScreenHeading title={copy.signInTitle} subtitle={copy.signInDescription} /> */}
      <SignInForm copy={copy} />
      {/* <Text style={styles.privacy}>
        {language === "sn"
          ? "Nzvimbo yemotokari inogoverwa chete parwendo rwunenge rwuchishanda."
          : language === "nd"
            ? "Indawo yemota yabiwa kuphela nxa uhambo luqhubeka."
            : "Vehicle location is shared only during an active trip."}
      </Text> */}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 24,
    paddingTop: 36,
    paddingBottom: 36,
  },
  brand: { gap: 4 },
  brandName: { color: colors.ink, fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  brandDescription: { color: colors.ink, opacity: 0.72, fontSize: 16 },
  privacy: {
    color: colors.ink,
    opacity: 0.72,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
