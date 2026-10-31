"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Field, Input, cx } from "./ui";
import { errorMessage } from "./Toast";

const RESEND_AFTER = 30;
const normalise = (email: string) => email.trim().toLowerCase();

/** State for verifying an email address with a 6-digit code. */
export function useEmailOtp() {
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [verified, setVerified] = useState<{ email: string; token: string } | null>(null);
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function send(email: string) {
    setError("");
    setBusy("send");
    try {
      const { token } = await api<{ token: string }>("/public/email-otp/send", { body: { email } });
      setOtpToken(token);
      setSentTo(normalise(email));
      setResendIn(RESEND_AFTER);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function verify(email: string, otp: string) {
    setError("");
    setBusy("verify");
    try {
      const { verificationToken } = await api<{ verificationToken: string }>("/public/email-otp/verify", { body: { email, otp, token: otpToken } });
      setVerified({ email: normalise(email), token: verificationToken });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return {
    send, verify, busy, error, resendIn,
    /** A code has been sent to this exact address and not yet verified */
    awaitingCode: (email: string) => !!otpToken && sentTo === normalise(email),
    /** Verification token for this address, or null if it isn't verified */
    tokenFor: (email: string) => (verified && verified.email === normalise(email) ? verified.token : null),
  };
}

export type EmailOtp = ReturnType<typeof useEmailOtp>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailOtpField({ value, onChange, otp, savedEmail, className }: {
  value: string;
  onChange: (v: string) => void;
  otp: EmailOtp;
  /** Email already on file (editing a student); keeping it needs no new code */
  savedEmail?: string;
  className?: string;
}) {
  const [code, setCode] = useState("");
  const verified = !!otp.tokenFor(value) || (!!savedEmail && normalise(savedEmail) === normalise(value));
  const awaiting = !verified && otp.awaitingCode(value);
  const submit = () => code.length === 6 && otp.verify(value, code);

  return (
    <div className={cx("space-y-3", className)}>
      <Field
        label="Email"
        required
        error={!awaiting ? otp.error || undefined : undefined}
        hint={verified ? undefined : awaiting ? undefined : "We'll send a 6-digit code to confirm it."}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type="email"
              placeholder="name@example.com"
              value={value}
              onChange={(e) => { onChange(e.target.value.replace(/[^a-zA-Z0-9@._+-]/g, "")); setCode(""); }}
              className={cx(verified && "border-emerald-300 pr-28 focus:border-emerald-400 focus:ring-emerald-500/10")}
            />
            {verified && (
              <span className="pointer-events-none absolute inset-y-0 right-2 my-auto flex h-7 items-center gap-1 rounded-lg bg-emerald-50 px-2 text-xs font-semibold text-emerald-700">
                <CheckCircle2 size={14} /> Verified
              </span>
            )}
          </div>
          {!verified && (
            <Button
              variant={awaiting ? "secondary" : "primary"}
              className="h-11 shrink-0"
              icon={<Mail size={15} />}
              loading={otp.busy === "send"}
              disabled={!EMAIL.test(value) || (awaiting && otp.resendIn > 0)}
              onClick={() => otp.send(value)}
            >
              {awaiting ? (otp.resendIn > 0 ? `Resend ${otp.resendIn}s` : "Resend") : "Send code"}
            </Button>
          )}
        </div>
      </Field>

      {awaiting && (
        <div className="animate-pop-in rounded-2xl border border-orange-100 bg-brand-soft/70 p-4">
          <p className="mb-3 text-sm text-slate-600">
            Code sent to <span className="font-semibold text-slate-900">{value}</span>
          </p>
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="• • • • • •"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
              aria-invalid={!!otp.error}
              className="max-w-44 text-center font-mono text-lg tracking-[0.4em]"
            />
            <Button className="h-11" loading={otp.busy === "verify"} disabled={code.length !== 6} onClick={submit}>Verify</Button>
          </div>
          {otp.error && <p className="mt-2 text-xs font-medium text-red-600">{otp.error}</p>}
        </div>
      )}
    </div>
  );
}
