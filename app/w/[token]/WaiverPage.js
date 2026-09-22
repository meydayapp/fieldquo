// app/w/[token]/WaiverPage.js — loads the waiver and mounts WaiverSign.
"use client";

import { useEffect, useState } from "react";
import WaiverSign from "@/app/components/public/WaiverSign";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";

export default function WaiverPage({ token }) {
  const [waiver, setWaiver] = useState(null);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError("");
      setOffline(false);
      let res;
      try {
        res = await fetch(`/api/public/waivers/${token}`);
      } catch {
        if (!cancelled) setOffline(true);
        return;
      }
      const data = await res.json().catch(() => null);
      if (cancelled) return;
      if (!res.ok) {
        setError(data?.error || clientDocCopy("en").selfQuote.linkInvalid);
        return;
      }
      setWaiver(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  const en = clientDocCopy("en");
  return (
    <div className="min-h-dvh bg-[#f5f2ec] py-8 sm:py-14 px-4">
      <div className="max-w-2xl mx-auto">
        {offline ? (
          <div className="bg-white border border-black/10 rounded-2xl p-8 text-center">
            <p className="text-lg font-semibold text-[#2d2520]">{en.connectionLost}</p>
            <p className="text-sm text-[#2d2520]/60 mt-2">{en.connectionLostHint}</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="mt-5 px-6 py-3 rounded-full text-sm font-semibold border border-black/15 text-[#2d2520]">
              {en.tryAgain}
            </button>
          </div>
        ) : error ? (
          <div className="bg-white border border-black/10 rounded-2xl p-8 text-center">
            <p className="text-lg font-semibold text-[#2d2520]">{error}</p>
            <p className="text-sm text-[#2d2520]/60 mt-2">{en.linkInvalidHint}</p>
          </div>
        ) : !waiver ? (
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-black/10 rounded w-1/3" />
            <div className="h-64 bg-black/10 rounded-xl" />
          </div>
        ) : (
          <>
            <WaiverSign waiver={{ ...waiver, token }} company={waiver.company} language={waiver.language} />
            <p className="text-center text-xs text-[#2d2520]/60 mt-6">
              {clientDocCopy(waiver.language).quoteQuestions(waiver.company?.name, waiver.company?.phone)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
