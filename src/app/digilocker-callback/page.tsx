"use client";

import { useEffect } from "react";
import { DIGILOCKER_CHANNEL } from "@/components/AadhaarDigilocker";

// DigiLocker redirects here after the student allows (or denies) access to their Aadhaar.
// Tell the registration form to check the result now, then close this popup.
export default function DigilockerCallbackPage() {
  useEffect(() => {
    try {
      const channel = new BroadcastChannel(DIGILOCKER_CHANNEL);
      channel.postMessage("done");
      channel.close();
    } catch {
      // Older browser: the form's slow poll still picks up the result.
    }
    if (window.opener) window.close();
  }, []);

  return (
    <div className="mx-auto my-20 max-w-md px-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">DigiLocker step complete</h1>
      <p className="mt-2 text-sm text-slate-500">You can close this window and go back to the registration form.</p>
    </div>
  );
}
