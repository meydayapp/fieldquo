"use client";

// app/sales/voicemail/page.js
//
// The messages left for this rep.
//
// ══ Why this screen had to exist ══════════════════════════════════════════
//
// A voicemail left on a rep's own number was written to the database and
// played on exactly one screen: /platform/sales/floor, the superadmin board.
// So a contractor could ring the number a rep gave them, leave that rep a
// message, and the rep had no way to hear it. Written and never read, in its
// reachability form — and what it loses is a callback from somebody who
// already wanted to talk.
//
// ══ Why a zero-second message is shown ════════════════════════════════════
//
// Because it means something. The recorder fires after a few seconds of
// silence, so a zero-length recording is a contractor who rang back, heard the
// beep and thought better of speaking. Warmer than a missed call, colder than
// a message, and worth a callback — hiding it as "empty" throws away the
// warmest signal on the screen.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Voicemail, PhoneMissed } from "lucide-react";

import { fetchJson } from "@/lib/fetchJson";

function pretty(e164) {
  const s = String(e164 || "");
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(s);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : s || "an unknown number";
}

function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function spoken(seconds) {
  if (seconds === null || seconds === undefined) return null;
  if (seconds === 0) return "no words spoken";
  return `${seconds}s`;
}

export default function SalesVoicemailPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/sales/voicemail"));
      setError("");
    } catch (err) {
      setError(err?.message || "Could not load your messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading your messages…</p>;

  const list = data?.voicemails || [];

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Voicemail</h1>
        <p className="text-sm text-muted-foreground">
          Messages left on your number when you could not pick up.
          {data?.numbers?.length ? ` Your number: ${data.numbers.map(pretty).join(", ")}.` : ""}
        </p>
      </header>

      {error ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 break-words">{error}</p>
      ) : null}

      {list.length === 0 && !error ? (
        <div className="rounded-xl border border-border p-6 text-center">
          <Voicemail size={22} className="mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-foreground">No messages.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.numbers?.length
              ? "When somebody rings your number and nobody picks up, their message lands here."
              : "You have no number assigned yet, so nobody can ring you directly. Ask for one and messages will land here."}
          </p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {list.map((v) => (
          <li key={v.id} className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-semibold text-foreground break-words">
                  {v.businessName || pretty(v.fromE164)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {v.businessName ? `${pretty(v.fromE164)} · ` : ""}
                  {when(v.leftAt)}
                  {spoken(v.seconds) ? ` · ${spoken(v.seconds)}` : ""}
                </div>
              </div>
              {v.href ? (
                <Link href={v.href} className="text-sm font-medium text-primary hover:underline">
                  Open the record
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground">Not matched to a business</span>
              )}
            </div>

            {v.silent ? (
              <p className="text-sm text-muted-foreground flex gap-2">
                <PhoneMissed size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
                They rang back, heard the beep and hung up without speaking. Worth a call.
              </p>
            ) : null}

            {/* Served by FieldQuo, never the provider\'s URL — see
                lib/sales/calls/voicemail.js. */}
            <audio controls preload="none" className="w-full" src={v.audioHref}>
              <a href={v.audioHref}>Play the message</a>
            </audio>
          </li>
        ))}
      </ul>
    </div>
  );
}
