"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { emailProblem, normaliseEmail, suggestEmail } from "@/lib/email";
import { Button, Field, Input, cx } from "./ui";
import { errorMessage } from "./Toast";

// The resend cooldowns, the per-email limits and the code's expiry are all decided by the backend;
// this form only shows them. The numbers it gets back drive the countdowns.

type SendResponse = { token: string; email: string; expiresIn: number; resendAfter: number };

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** State for verifying an email address with a 6-digit code. */
export function useEmailOtp() {
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [verified, setVerified] = useState<{ email: string; token: string } | null>(null);
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState("");
  /** "Did you mean …?" for the address as typed; null once the user decided */
  const [typo, setTypo] = useState<{ email: string; suggestion: string } | null>(null);
  /** Addresses the user said are right despite looking like a typo */
  const [keptAsTyped, setKeptAsTyped] = useState<string[]>([]);
  // Deadlines (ms) rather than counters, so a sleeping tab still shows the right time.
  const [resendAt, setResendAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (resendAt <= now && expiresAt <= now) return;
    const t = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(t);
  }, [now, resendAt, expiresAt]);

  const startCountdown = (seconds: number) => {
    setNow(Date.now());
    setResendAt(Date.now() + seconds * 1000);
  };

  async function send(raw: string) {
    const email = normaliseEmail(raw);
    const problem = emailProblem(email);
    if (problem) return setError(problem);
    const confirmTypo = keptAsTyped.includes(email);
    const suggestion = suggestEmail(email);
    if (suggestion && !confirmTypo) return setTypo({ email, suggestion });
    setError("");
    setTypo(null);
    setBusy("send");
    try {
      const data = await api<SendResponse>("/public/email-otp/send", { body: { email, confirmTypo } });
      setOtpToken(data.token);
      setSentTo(data.email);
      setExpiresAt(Date.now() + data.expiresIn * 1000);
      startCountdown(data.resendAfter);
    } catch (err) {
      if (err instanceof ApiError && err.data.code === "EMAIL_TYPO" && typeof err.data.suggestion === "string") {
        setTypo({ email, suggestion: err.data.suggestion });
      } else {
        if (err instanceof ApiError && typeof err.data.retryAfter === "number") startCountdown(err.data.retryAfter);
        setError(errorMessage(err));
      }
    } finally {
      setBusy(null);
    }
  }

  async function verify(raw: string, otp: string) {
    const email = normaliseEmail(raw);
    setError("");
    setBusy("verify");
    try {
      const { verificationToken } = await api<{ verificationToken: string }>("/public/email-otp/verify", { body: { email, otp, token: otpToken } });
      setVerified({ email, token: verificationToken });
      setOtpToken(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return {
    send, verify, busy, error,
    /** Seconds until another code may be requested (0 = now) */
    resendIn: Math.max(0, Math.ceil((resendAt - now) / 1000)),
    /** Seconds until the code that was sent expires (0 = expired) */
    expiresIn: Math.max(0, Math.ceil((expiresAt - now) / 1000)),
    /** The "did you mean …?" prompt for this address, if any */
    typoFor: (email: string) => (typo && typo.email === normaliseEmail(email) ? typo.suggestion : null),
    /** The user says the address is right as typed: send to it */
    keepAsTyped: (email: string) => {
      const address = normaliseEmail(email);
      setKeptAsTyped((list) => [...list, address]);
      setTypo(null);
    },
    dismissTypo: () => setTypo(null),
    clearError: () => setError(""),
    /** A code has been sent to this exact address and not yet verified */
    awaitingCode: (email: string) => !!otpToken && sentTo === normaliseEmail(email),
    /** Verification token for this address, or null if it isn't verified */
    tokenFor: (email: string) => (verified && verified.email === normaliseEmail(email) ? verified.token : null),
  };
}

export type EmailOtp = ReturnType<typeof useEmailOtp>;

export function EmailOtpField({ value, onChange, otp, savedEmail, className }: {
  value: string;
  onChange: (v: string) => void;
  otp: EmailOtp;
  /** Email already on file (editing a student); keeping it needs no new code */
  savedEmail?: string;
  className?: string;
}) {
  const [code, setCode] = useState("");
  // Format errors show once the user leaves the field (or tries to send), not while they're typing.
  const [touched, setTouched] = useState(false);
  const verified = !!otp.tokenFor(value) || (!!savedEmail && normaliseEmail(savedEmail) === normaliseEmail(value));
  const awaiting = !verified && otp.awaitingCode(value);
  const expired = awaiting && otp.expiresIn === 0;
  const formatProblem = value ? emailProblem(value) : null;
  const suggestion = otp.typoFor(value);
  const submit = () => code.length === 6 && !expired && otp.verify(value, code);
  const sendCode = () => {
    setTouched(true);
    onChange(normaliseEmail(value));
    otp.send(value);
  };

  const fieldError = verified ? undefined : (touched && formatProblem) || (!awaiting && !suggestion ? otp.error || undefined : undefined);

  return (
    <div className={cx("space-y-3", className)}>
      <Field
        label="Email"
        required
        error={fieldError}
        hint={verified || awaiting || fieldError ? undefined : "We'll send a 6-digit code to confirm it."}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={320}
              placeholder="name@example.com"
              value={value}
              onChange={(e) => { onChange(e.target.value); setCode(""); otp.dismissTypo(); otp.clearError(); }}
              // Spaces around the address are trimmed and capitals lower-cased, as it will be stored.
              onBlur={() => { if (value) { setTouched(true); onChange(normaliseEmail(value)); } }}
              aria-invalid={!!fieldError}
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
              disabled={!value.trim() || !!formatProblem || otp.resendIn > 0}
              onClick={sendCode}
            >
              {otp.resendIn > 0 ? `${awaiting ? "Resend" : "Send"} in ${clock(otp.resendIn)}` : awaiting ? "Resend code" : "Send code"}
            </Button>
          )}
        </div>
      </Field>

      {/* Never corrected automatically: the user picks. */}
      {!verified && suggestion && (
        <div className="animate-pop-in rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="flex items-start gap-2 text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>Did you mean <span className="font-semibold">{suggestion}</span>?</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="h-9" onClick={() => { onChange(suggestion); otp.dismissTypo(); }}>Use {suggestion.slice(suggestion.indexOf("@"))}</Button>
            <Button variant="secondary" className="h-9" onClick={() => otp.keepAsTyped(value)}>No, {normaliseEmail(value)} is correct</Button>
          </div>
        </div>
      )}

      {awaiting && (
        <div className="animate-pop-in rounded-2xl border border-orange-100 bg-brand-soft/70 p-4">
          <p className="mb-3 text-sm text-slate-600">
            Enter the 6-digit code sent to <span className="font-semibold text-slate-900">{normaliseEmail(value)}</span>
          </p>
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="• • • • • •"
              value={code}
              disabled={expired}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
              aria-invalid={!!otp.error}
              className="max-w-44 text-center font-mono text-lg tracking-[0.4em]"
            />
            <Button className="h-11" loading={otp.busy === "verify"} disabled={code.length !== 6 || expired} onClick={submit}>Verify</Button>
          </div>
          {otp.error && <p className="mt-2 text-xs font-medium text-red-600">{otp.error}</p>}
          <p className="mt-2 text-xs text-slate-500">
            {expired ? (
              <span className="font-medium text-red-600">This code has expired. {otp.resendIn > 0 ? `You can request a new one in ${clock(otp.resendIn)}.` : "Request a new one."}</span>
            ) : (
              <>Code expires in {clock(otp.expiresIn)}.{otp.resendIn > 0 ? ` You can resend in ${clock(otp.resendIn)}.` : " Didn't get it? Check spam, then resend."}</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
