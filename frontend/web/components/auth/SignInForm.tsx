import { useState, type FormEvent } from "react";
import { useRouter } from "next/router";
import type { AuthCopy } from "./auth-copy";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { getWebApi } from "../../lib/api";

export function SignInForm({
  copy,
  serviceUnavailable = false,
}: {
  copy: AuthCopy;
  serviceUnavailable?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim();
    const next = {
      email: !normalized
        ? copy.requiredEmail
        : !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalized)
          ? copy.invalidEmail
          : undefined,
      password: password ? undefined : copy.requiredPassword,
    };
    setErrors(next);
    setMessage("");
    if (next.email || next.password || loading) return;
    if (serviceUnavailable) {
      setMessage(copy.authenticationUnavailable);
      return;
    }

    setLoading(true);
    try {
      const api = getWebApi();
      const result = await api.auth.signIn({ email: normalized, password });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }

      const activeSchool = result.data.activeSchool;
      const membership = activeSchool
        ? result.data.memberships.find(
            (item) => item.schoolId === activeSchool.id && item.active,
          )
        : undefined;

      if (membership?.role !== "school_admin") {
        await api.auth.signOut();
        setMessage("This account uses the preDrive mobile app. Contact your school if you need dashboard access.");
        return;
      }

      await router.replace("/admin");
    } catch {
      setMessage(copy.authenticationUnavailable);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink">{copy.signInTitle}</h1>
        <p className="mt-2 text-sm leading-6 text-ink/70">{copy.signInDescription}</p>
      </div>
      <TextField
        label={copy.emailLabel}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setMessage("");
        }}
        placeholder={copy.emailPlaceholder}
        error={errors.email}
      />
      <div className="grid gap-2">
        <TextField
          label={copy.passwordLabel}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setMessage("");
          }}
          placeholder={copy.passwordPlaceholder}
          error={errors.password}
        />
        <a href="/forgot-password" className="min-h-11 justify-self-end pt-3 text-sm font-semibold text-ink underline">
          {copy.forgotPassword}
        </a>
      </div>
      <Button type="submit" fullWidth loading={loading} disabled={serviceUnavailable}>
        {copy.signInAction}
      </Button>
      {message ? (
        <p role="alert" className="rounded-lg border border-warning bg-[#FFF8E8] p-3 text-sm leading-5 text-ink">
          {message}
        </p>
      ) : null}
      {serviceUnavailable ? (
        <p role="status" className="rounded-lg border border-warning bg-[#FFF8E8] p-3 text-sm leading-5 text-ink">
          {copy.authenticationUnavailable}
        </p>
      ) : null}
    </form>
  );
}
