"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { Button, Field, Input, cx } from "./ui";
import { errorMessage } from "./Toast";

// Aadhaar verification through DigiLocker (UIDAI discontinued the Aadhaar OTP API), with the same
// call limits as the main TNJA site. DigiLocker opens in a popup so the half-filled form is kept.
// The backend also checks that the pincode on the Aadhaar address and the date of birth on the
// Aadhaar match the pincode and date of birth entered.
//
// Every check costs a Sandbox status call. The callback page announces when DigiLocker is done,
// which triggers the one check that matters; the timer is only a safety net for browsers where that
// message can't arrive, so it stays quiet while a normal sign-in takes place.
// Worst case (user abandons): at most 8 checks, from minute 3 to minute 10.
const FIRST_SAFETY_CHECK_MS = 3 * 60 * 1000;
const SAFETY_POLL_MS = 60 * 1000;
const MAX_WAIT_MS = 10 * 60 * 1000;
// A callback that lands during a check gets one follow-up check this long after it ends
// (longer than the backend's 4 s per-session throttle, which would otherwise answer "pending").
const FOLLOW_UP_CHECK_MS = 5 * 1000;
// "Check now" clicks closer together than this reuse the last answer instead of calling again.
const MANUAL_CHECK_GAP_MS = 10 * 1000;
export const DIGILOCKER_CHANNEL = "tnja-tournament-digilocker";

const AADHAAR = /^[2-9]\d{11}$/;
const PINCODE = /^[1-9]\d{5}$/;
const DOB = /^\d{4}-\d{2}-\d{2}$/;

type Status = "idle" | "starting" | "waiting" | "verified";
type Session = { aadhaarNumber: string; token: string; startedAt: number };
type CheckResponse = { status: "pending" } | { status: "verified"; aadhaarVerificationToken: string };

export function useAadhaarDigilocker() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [verified, setVerified] = useState<{ aadhaar: string; pincode: string; dob: string; token: string } | null>(null);
  const session = useRef<Session | null>(null);
  const pincodeRef = useRef("");
  const dobRef = useRef("");
  const popup = useRef<Window | null>(null);
  const inFlight = useRef(false);
  const checkNowRef = useRef<() => void>(() => {});

  const stop = useCallback((message: string) => {
    session.current = null;
    popup.current?.close();
    popup.current = null;
    setAuthorizationUrl(null);
    setError(message);
    setStatus("idle");
  }, []);

  async function start(aadhaarNumber: string, pincode: string, dob: string) {
    // Each start is a paid Sandbox session: ignore double clicks and clicks while one is open.
    if (inFlight.current || session.current) return;
    if (!AADHAAR.test(aadhaarNumber)) return setError("Please enter a valid 12-digit Aadhaar number.");
    if (!PINCODE.test(pincode)) return setError("Please enter your 6-digit pincode first.");
    if (!DOB.test(dob)) return setError("Please enter your date of birth first.");
    // Open the popup synchronously in the click handler so browsers don't block it.
    inFlight.current = true;
    popup.current = window.open("", "digilocker", "width=520,height=720");
    setStatus("starting");
    setError("");
    setVerified(null);
    try {
      const data = await api<{ authorizationUrl: string; digilockerSessionToken: string }>("/public/aadhaar/digilocker/start", { body: { aadhaarNumber, pincode, dob } });
      session.current = { aadhaarNumber, token: data.digilockerSessionToken, startedAt: Date.now() };
      pincodeRef.current = pincode;
      dobRef.current = dob;
      setAuthorizationUrl(data.authorizationUrl);
      if (popup.current && !popup.current.closed) popup.current.location.href = data.authorizationUrl;
      setStatus("waiting");
    } catch (err) {
      stop(errorMessage(err));
    } finally {
      inFlight.current = false;
    }
  }

  useEffect(() => {
    if (status !== "waiting") return;
    let cancelled = false;
    let checking = false;
    let followUp = false;
    let lastCheckAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (delay: number) => {
      if (cancelled) return;
      clearTimeout(timer);
      timer = setTimeout(check, delay);
    };

    const check = async () => {
      const current = session.current;
      if (cancelled || !current || checking) return;
      if (Date.now() - current.startedAt > MAX_WAIT_MS) return stop("Verification timed out. Please click Verify again.");
      checking = true;
      lastCheckAt = Date.now();
      try {
        const data = await api<CheckResponse>("/public/aadhaar/digilocker/check", { body: { aadhaarNumber: current.aadhaarNumber, digilockerSessionToken: current.token } });
        if (cancelled || session.current !== current) return;
        if (data.status === "verified") {
          stop("");
          setVerified({ aadhaar: current.aadhaarNumber, pincode: pincodeRef.current, dob: dobRef.current, token: data.aadhaarVerificationToken });
          setStatus("verified");
          return;
        }
      } catch (err) {
        // A real answer (wrong Aadhaar, pincode mismatch, cancelled, expired) ends the session; a network blip doesn't.
        if (!cancelled && session.current === current && err instanceof ApiError) return stop(err.message);
      } finally {
        checking = false;
      }
      // The answer above may predate the callback, so check once more shortly; otherwise wait for the safety net.
      const delay = followUp ? FOLLOW_UP_CHECK_MS : SAFETY_POLL_MS;
      followUp = false;
      schedule(delay);
    };

    // The callback page posts here when DigiLocker redirects back: check right away, or once
    // more after the check already in progress (never two at the same time).
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(DIGILOCKER_CHANNEL);
      channel.onmessage = () => {
        if (checking) {
          followUp = true;
          return;
        }
        clearTimeout(timer);
        check();
      };
    } catch {
      // No BroadcastChannel: the slow poll still picks up the result.
    }

    checkNowRef.current = () => {
      if (checking || Date.now() - lastCheckAt < MANUAL_CHECK_GAP_MS) return;
      clearTimeout(timer);
      check();
    };

    schedule(FIRST_SAFETY_CHECK_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      channel?.close();
      checkNowRef.current = () => {};
    };
  }, [status, stop]);

  return {
    start,
    error,
    authorizationUrl,
    starting: status === "starting",
    waiting: status === "waiting",
    /** Verification token for this Aadhaar number, pincode and date of birth, or null if they aren't verified together */
    tokenFor: (aadhaar: string, pincode: string, dob: string) =>
      verified && verified.aadhaar === aadhaar && verified.pincode === pincode && verified.dob === dob ? verified.token : null,
    /** For "I've finished in DigiLocker": checks once now (rate limited) instead of waiting for the timer. */
    checkNow: () => checkNowRef.current(),
    cancel: () => stop(""),
  };
}

export type AadhaarDigilocker = ReturnType<typeof useAadhaarDigilocker>;

/** Aadhaar number with a "Verify with DigiLocker" button. */
export function AadhaarDigilockerField({ value, onChange, pincode, dob, digilocker, className }: {
  value: string;
  onChange: (v: string) => void;
  /** The residing pincode the Aadhaar address must match */
  pincode: string;
  /** The date of birth (YYYY-MM-DD) the Aadhaar must match */
  dob: string;
  digilocker: AadhaarDigilocker;
  className?: string;
}) {
  const verified = !!digilocker.tokenFor(value, pincode, dob);
  const busy = digilocker.starting || digilocker.waiting;

  return (
    <div className={cx("space-y-3", className)}>
      <Field
        label="Aadhaar number"
        required
        error={!busy ? digilocker.error || undefined : undefined}
        hint={verified || busy ? undefined : DOB.test(dob) ? "Verify with DigiLocker. The pincode and date of birth on your Aadhaar must match the ones above." : "Enter your date of birth above, then verify with DigiLocker."}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              inputMode="numeric"
              placeholder="12 digits"
              value={value}
              disabled={busy}
              onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 12))}
              className={cx("tracking-wide", verified && "border-emerald-300 pr-28 focus:border-emerald-400 focus:ring-emerald-500/10")}
            />
            {verified && (
              <span className="pointer-events-none absolute inset-y-0 right-2 my-auto flex h-7 items-center gap-1 rounded-lg bg-emerald-50 px-2 text-xs font-semibold text-emerald-700">
                <CheckCircle2 size={14} /> Verified
              </span>
            )}
          </div>
          {!verified && !busy && (
            <Button className="h-11 shrink-0" icon={<ShieldCheck size={15} />} disabled={!AADHAAR.test(value) || !PINCODE.test(pincode) || !DOB.test(dob)} onClick={() => digilocker.start(value, pincode, dob)}>
              Verify
            </Button>
          )}
        </div>
      </Field>

      {busy && (
        <div className="animate-pop-in rounded-2xl border border-orange-100 bg-brand-soft/70 p-4">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 size={15} className="animate-spin text-brand" />
            {digilocker.starting ? "Opening DigiLocker…" : "Sign in to DigiLocker in the new window and allow access to your Aadhaar."}
          </p>
          {digilocker.waiting && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button className="h-10" onClick={digilocker.checkNow}>I&apos;ve finished</Button>
              {digilocker.authorizationUrl && (
                <a href={digilocker.authorizationUrl} target="digilocker" rel="noopener" className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-brand hover:underline">
                  Open DigiLocker again <ExternalLink size={14} />
                </a>
              )}
              <Button variant="secondary" className="h-10" onClick={digilocker.cancel}>Cancel</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
