import { Stack } from "expo-router";
import { colors } from "@predrive/shared/tokens";
import { PreDriveI18nProvider,memoryLanguageStorage } from "@predrive/shared/i18n";
import { AuthSessionProvider } from "../src/auth/session";
import { mobileAuthSessionSource } from "../src/lib/auth-session-source";

export default function RootLayout() {
  return (
    <PreDriveI18nProvider storage={memoryLanguageStorage}>
      <AuthSessionProvider source={mobileAuthSessionSource}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: "fade" }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="signin" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="access-denied" />
          <Stack.Screen name="(guardian)" />
          <Stack.Screen name="(supervisor)" />
          <Stack.Screen name="(driver)" />
          <Stack.Screen name="(teacher)" />
        </Stack>
      </AuthSessionProvider>
    </PreDriveI18nProvider>
  );
}
