import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { colors } from "@predrive/shared/tokens";
import { ActionButton } from "../ui/action-button";
import { AppCard } from "../ui/app-card";
import { AuthTextField } from "./auth-text-field";
import type { MobileAuthCopy } from "./auth-copy";
import { mobileApi } from "@/src/lib/api";

export function PasswordResetForm({ copy }: { copy: MobileAuthCopy }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const value = email.trim();
    if (!value) {
      setError(copy.emailRequired);
      setMessage("");
      return;
    }
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) {
      setError(copy.emailInvalid);
      setMessage("");
      return;
    }
    setError("");
    setMessage("");
    if (!mobileApi) {
      setMessage(copy.resetUnavailableDescription);
      return;
    }

    setLoading(true);
    try {
      const result = await mobileApi.auth.requestPasswordReset({ email: value });
      if (!result.ok) {
        setMessage(result.error.message);
      } else {
        setMessage("If the address is registered, password reset instructions will be sent.");
      }
    } catch {
      setMessage(copy.resetUnavailableDescription);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppCard style={s.card}>
      <AuthTextField
        label={copy.emailLabel}
        placeholder={copy.emailPlaceholder}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setError("");
          setMessage("");
        }}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        error={error}
      />
      <ActionButton
        label={copy.sendResetLink}
        onPress={submit}
        loading={loading}
        disabled={!mobileApi}
      />
      {message ? (
        <View accessibilityLiveRegion="polite" style={s.notice}>
          <Text style={s.noticeTitle}>{copy.resetUnavailableTitle}</Text>
          <Text style={s.noticeBody}>{message}</Text>
        </View>
      ) : null}
      <Link href="/signin" style={s.link}>
        {copy.backToSignIn}
      </Link>
    </AppCard>
  );
}

const s = StyleSheet.create({
  card: { padding: 20, gap: 20 },
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
  link: {
    minHeight: 44,
    textAlign: "center",
    textAlignVertical: "center",
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
