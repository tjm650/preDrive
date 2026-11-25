import { useState, type FormEvent } from "react";
import type { AuthCopy } from "./auth-copy";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { getWebApi } from "../../lib/api";

export function PasswordResetForm({
  copy,
  serviceUnavailable = false,
}: {
  copy: AuthCopy;
  serviceUnavailable?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!value) {
      setError(copy.requiredEmail);
      setMessage("");
      return;
    }
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) {
      setError(copy.invalidEmail);
      setMessage("");
      return;
    }
    setError("");
    setMessage("");
    if (serviceUnavailable) {
      setMessage(copy.emailSentDescription);
      return;
    }

    setLoading(true);
    try {
      const result = await getWebApi().auth.requestPasswordReset({ email: value });
      setMessage(result.ok ? copy.resetSentDescription : result.error.message);
    } catch {
      setMessage(copy.emailSentDescription);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink">{copy.resetTitle}</h1>
        <p className="mt-2 text-sm leading-6 text-ink/70">{copy.resetDescription}</p>
      </div>
      <TextField
        label={copy.emailLabel}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setError("");
          setMessage("");
        }}
        placeholder={copy.emailPlaceholder}
        error={error}
      />
      <Button type="submit" fullWidth loading={loading} disabled={serviceUnavailable}>
        {copy.sendResetLink}
      </Button>
      {message ? (
        <p role="status" className="rounded-lg border border-warning bg-[#FFF8E8] p-3 text-sm leading-5 text-ink">
          {message}
        </p>
      ) : null}
      <a href="/signin" className="min-h-11 pt-3 text-center text-sm font-semibold text-ink underline">
        {copy.backToSignIn}
      </a>
    </form>
  );
}
