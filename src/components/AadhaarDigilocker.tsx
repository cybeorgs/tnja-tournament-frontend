"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { PINCODE_PATTERN } from "@/lib/locations";
import { Button, Field, Input, cx } from "./ui";
import { errorMessage } from "./Toast";

// Aadhaar verification through DigiLocker (UIDAI discontinued the Aadhaar OTP API). DigiLocker opens
// in a popup so the half-filled form is kept. The backend also checks that the pincode and the date of
// birth on the Aadhaar match the ones entered.
//
// Every Sandbox call is billed, so the form asks the backend only when there is a reason to:
// - the callback page announces that DigiLocker is done (the one check that normally matters);
// - the popup closes (DigiLocker finished or the student gave up): one check;
// - "I've finished" (rate limited).
// The timer is only a safety net for when the popup can't be watched (blocked, or opened from the
// link): first at 3 minutes, then every 2 minutes, never while the popup is still open.
// Clicking Verify again first asks /resume (free): after a pincode or date-of-birth mismatch the
// corrected values are matched against the Aadhaar already fetched, and a popup closed too early
// reopens the same DigiLocker session, so neither costs a new paid session.
const FIRST_SAFETY_CHECK_MS = 3 * 60 * 1000;
const SAFETY_POLL_MS = 2 * 60 * 1000;
const MAX_WAIT_MS = 10 * 60 * 1000;
// A callback that lands during a check gets one follow-up check this long after it ends
// (longer than the backend's 4 s per-session throttle, which would otherwise answer "pending").
const FOLLOW_UP_CHECK_MS = 5 * 1000;
// "Check now" clicks closer together than this reuse the last answer instead of calling again.
const MANUAL_CHECK_GAP_MS = 10 * 1000;
// How often the (free) popup.closed flag is read.
const POPUP_WATCH_MS = 1000;
// After the popup closes, wait this long for the callback's message before checking ourselves.
const POPUP_CLOSED_CHECK_DELAY_MS = 1500;
// A popup that "closes" sooner than this after opening was cut off by the browser (e.g. DigiLocker's
// opener policy), not finished by the student, so it says nothing and the safety net takes over.
const MIN_REAL_POPUP_MS = 20 * 1000;
export const DIGILOCKER_CHANNEL = "tnja-tournament-digilocker";

const AADHAAR = /^[2-9]\d{11}$/;
const PINCODE = PINCODE_PATTERN;
const DOB = /^\d{4}-\d{2}-\d{2}$/;

type Status = "idle" | "starting" | "waiting" | "verified";
type Session = { aadhaarNumber: string; token: string; startedAt: number };
type CheckResponse = { status: "pending" } | { status: "verified"; aadhaarVerificationToken: string };
type ResumeResponse =
  | { status: "new" }
  | { status: "open"; authorizationUrl: string; digilockerSessionToken: string }
  | { status: "verified"; aadhaarVerificationToken: string };

export function useAadhaarDigilocker() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [verified, setVerified] = useState<{ aadhaar: string; pincode: string; dob: string; token: string } | null>(null);
  const session = useRef<Session | null>(null);
  // The last session, kept after it ends (mismatch, cancel, popup closed) so Verify can resume it for free.
  const lastSession = useRef<Session | null>(null);
  const pincodeRef = useRef("");
  const dobRef = useRef("");
  const popup = useRef<Window | null>(null);
  const popupOpenedAt = useRef(0);
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

  const openPopup = (url: string) => {
    popup.current = window.open(url, "digilocker", "width=520,height=720");
    popupOpenedAt.current = Date.now();
  };

  function wait(next: Session, url: string, pincode: string, dob: string) {
    session.current = next;
    lastSession.current = next;
    pincodeRef.current = pincode;
    dobRef.current = dob;
    setAuthorizationUrl(url);
    if (popup.current && !popup.current.closed) {
      popup.current.location.href = url;
      popupOpenedAt.current = Date.now();
    }
    setStatus("waiting");
  }

  /** Free: reuses the last session for this Aadhaar. Returns true when it settled the click. */
  async function resume(aadhaarNumber: string, pincode: string, dob: string): Promise<boolean> {
    const last = lastSession.current;
    if (!last || last.aadhaarNumber !== aadhaarNumber || Date.now() - last.startedAt > MAX_WAIT_MS * 3) return false;
    try {
      const data = await api<ResumeResponse>("/public/aadhaar/digilocker/resume", { body: { aadhaarNumber, pincode, dob, digilockerSessionToken: last.token } });
      if (data.status === "verified") {
        stop("");
        setVerified({ aadhaar: aadhaarNumber, pincode, dob, token: data.aadhaarVerificationToken });
        setStatus("verified");
        return true;
      }
      if (data.status === "open") {
        wait({ aadhaarNumber, token: data.digilockerSessionToken, startedAt: last.startedAt }, data.authorizationUrl, pincode, dob);
        return true;
      }
    } catch (err) {
      // Still a mismatch with the corrected values: say so, no new session needed.
      if (err instanceof ApiError && err.status === 400) {
        stop(err.message);
        return true;
      }
    }
    lastSession.current = null;
    return false;
  }

  async function start(aadhaarNumber: string, pincode: string, dob: string) {
    // Each start is a paid Sandbox session: ignore double clicks and clicks while one is open.
    if (inFlight.current || session.current) return;
    if (!AADHAAR.test(aadhaarNumber)) return setError("Please enter a valid 12-digit Aadhaar number.");
    if (!PINCODE.test(pincode)) return setError("Please enter your 6-digit pincode first.");
    if (!DOB.test(dob)) return setError("Please enter your date of birth first.");
    // Open the popup synchronously in the click handler so browsers don't block it.
    inFlight.current = true;
    openPopup("");
    setStatus("starting");
    setError("");
    setVerified(null);
    try {
      if (await resume(aadhaarNumber, pincode, dob)) return;
      const data = await api<{ authorizationUrl: string; digilockerSessionToken: string }>("/public/aadhaar/digilocker/start", { body: { aadhaarNumber, pincode, dob } });
      wait({ aadhaarNumber, token: data.digilockerSessionToken, startedAt: Date.now() }, data.authorizationUrl, pincode, dob);
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

    const popupOpen = () => !!popup.current && !popup.current.closed;

    const schedule = (delay: number) => {
      if (cancelled) return;
      clearTimeout(timer);
      timer = setTimeout(safetyCheck, delay);
    };

    // The student is still in DigiLocker while the popup is open: nothing to ask yet.
    const safetyCheck = () => (popupOpen() ? schedule(SAFETY_POLL_MS) : check());

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

    const checkSoon = () => {
      if (checking) {
        followUp = true;
        return;
      }
      clearTimeout(timer);
      check();
    };

    // The callback page posts here when DigiLocker redirects back: check right away, or once
    // more after the check already in progress (never two at the same time).
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(DIGILOCKER_CHANNEL);
      channel.onmessage = checkSoon;
    } catch {
      // No BroadcastChannel: the popup watch and the safety net still pick up the result.
    }

    // Free: notice the popup closing (the callback page closes it, or the student gives up) and check
    // once, unless the callback's message already triggered a check.
    let watchedPopup = popupOpen() ? popup.current : null;
    const watch = setInterval(() => {
      if (!watchedPopup) {
        watchedPopup = popupOpen() ? popup.current : null; // reopened with "Open DigiLocker again"
        return;
      }
      if (!watchedPopup.closed) return;
      watchedPopup = null;
      if (Date.now() - popupOpenedAt.current < MIN_REAL_POPUP_MS) return;
      setTimeout(() => {
        if (!cancelled && !checking && Date.now() - lastCheckAt > POPUP_CLOSED_CHECK_DELAY_MS * 2) checkSoon();
      }, POPUP_CLOSED_CHECK_DELAY_MS);
    }, POPUP_WATCH_MS);

    checkNowRef.current = () => {
      if (checking || Date.now() - lastCheckAt < MANUAL_CHECK_GAP_MS) return;
      clearTimeout(timer);
      check();
    };

    schedule(FIRST_SAFETY_CHECK_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(watch);
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
    /** Reopens the same DigiLocker session (free) in a watched popup. */
    reopen: () => {
      if (authorizationUrl && !(popup.current && !popup.current.closed)) openPopup(authorizationUrl);
      else popup.current?.focus();
    },
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
                <button type="button" onClick={digilocker.reopen} className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-brand hover:underline">
                  Open DigiLocker again <ExternalLink size={14} />
                </button>
              )}
              <Button variant="secondary" className="h-10" onClick={digilocker.cancel}>Cancel</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
