import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link, useRouter, type Href } from "expo-router";
import { colors } from "@predrive/shared/tokens";
import { ActionButton } from "../ui/action-button";
import { AppCard } from "../ui/app-card";
import { AuthTextField } from "./auth-text-field";
import type { MobileAuthCopy } from "./auth-copy";
import { mobileApi } from "@/src/lib/api";

const ROLE_ROUTES: Record<string, Href> = {
  guardian: "/(guardian)",
  supervisor: "/(supervisor)",
  driver: "/(driver)",
  teacher: "/(teacher)",
};

export function SignInForm({ copy }: { copy: MobileAuthCopy }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const normalized = email.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    setEmailError(!normalized ? copy.emailRequired : !valid ? copy.emailInvalid : "");
    setPasswordError(password ? "" : copy.passwordRequired);
    setErrorMessage("");
    if (!normalized || !valid || !password || loading) return;
    if (!mobileApi) {
      setErrorMessage(copy.serviceUnavailableDescription);
      return;
    }

    setLoading(true);
    try {
      const result = await mobileApi.auth.signIn({ email: normalized, password });
      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      const activeSchool = result.data.activeSchool;
      const membership = activeSchool
        ? result.data.memberships.find(
            (item) => item.schoolId === activeSchool.id && item.active,
          )
        : undefined;
      const destination = membership ? ROLE_ROUTES[membership.role] : undefined;

      if (!destination) {
        await mobileApi.auth.signOut();
        setErrorMessage("Your account does not have a mobile role for this school.");
        return;
      }
      router.replace(destination);
    } catch {
      setErrorMessage(copy.serviceUnavailableDescription);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppCard style={s.card}>
      <View style={s.fields}>
        <AuthTextField
          label={copy.emailLabel}
          placeholder={copy.emailPlaceholder}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setEmailError("");
            setErrorMessage("");
          }}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          error={emailError}
        />
        <AuthTextField
          label={copy.passwordLabel}
          placeholder={copy.passwordPlaceholder}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setPasswordError("");
            setErrorMessage("");
          }}
          secureTextEntry
          showPasswordLabel={copy.showPassword}
          hidePasswordLabel={copy.hidePassword}
          autoComplete="current-password"
          textContentType="password"
          error={passwordError}
        />
      </View>
      <View style={s.recovery}>
        <Link href="/forgot-password" style={s.link}>
          {copy.forgotPassword}
        </Link>
      </View>
      <ActionButton
        label={copy.signInAction}
        onPress={submit}
        disabled={!mobileApi}
        loading={loading}
      />
      {errorMessage ? (
        <View accessibilityRole="alert" style={s.notice}>
          <Text style={s.noticeTitle}>{copy.serviceUnavailableTitle}</Text>
          <Text style={s.noticeBody}>{errorMessage}</Text>
        </View>
      ) : null}
      {!mobileApi ? (
        <View accessibilityLiveRegion="polite" style={s.notice}>
          <Text style={s.noticeTitle}>{copy.serviceUnavailableTitle}</Text>
          <Text style={s.noticeBody}>{copy.serviceUnavailableDescription}</Text>
        </View>
      ) : null}
    </AppCard>
  );
}

const s = StyleSheet.create({
  card: { padding: 20, gap: 20 },
  fields: { gap: 18 },
  recovery: { alignItems: "flex-end" },
  link: {
    minHeight: 44,
    textAlignVertical: "center",
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  notice: {
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 12,
    backgroundColor: colors.canvas,
  },
  noticeTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  noticeBody: { color: colors.ink, fontSize: 16, lineHeight: 22 },
});
