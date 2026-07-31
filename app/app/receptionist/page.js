"use client";

// app/app/receptionist/page.js
//
// What the phone receptionist has been doing.
//
// Replaces the honest "coming soon" that stood here while the feature didn't
// exist.
//
// ── Flagged calls first, and they don't clear themselves ───────────────────
//
// A call the agent marked urgent — somebody said "flooding", "gas", "the
// ceiling is coming down" — sits at the top until a person marks it seen. It
// does NOT clear by being scrolled past, because the entire point of the flag
// is that somebody has to act on it today.
//
// ── It says what each call cost ────────────────────────────────────────────
//
// Per call, not just as a running balance. "Where did my credit go" is the first
// question anyone asks about prepaid anything, and the answer belongs beside the
// call rather than in a total they have to reconcile themselves.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Headset, Phone, PhoneOutgoing, AlertTriangle, Check, Play, Loader2, UserPlus, CalendarCheck, Settings,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";

const money = (c) => `$${(Number(c || 0) / 100).toFixed(2)}`;

function duration(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function ReceptionistPage() {
  const { formatDateTime } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/voice/calls");
    if (!res.ok) {
      await reportResponseError(res, "Couldn't load your calls.");
      return;
    }
    setData(await res.json());
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function markSeen(id) {
    setBusy(id);
    try {
      const res = await fetch("/api/voice/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        await reportResponseError(res, "Couldn't update that call.");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-24 bg-accent rounded-xl" />
        <div className="h-24 bg-accent rounded-xl" />
      </div>
    );
  }

  const calls = data?.calls || [];
  const flagged = calls.filter((c) => c.needsReview);
  const rest = calls.filter((c) => !c.needsReview);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[12rem]">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Headset size={22} /> Receptionist
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Calls it has taken for you, and what came of them.
          </p>
        </div>
        <Link
          href="/app/settings/voice"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted"
        >
          <Settings size={15} /> Set it up
        </Link>
      </div>

      {/* Not an error state. A company that hasn't turned it on yet, or that has
          had a quiet week, gets a sentence and a way forward rather than an
          empty grid. */}
      {calls.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Phone size={22} className="mx-auto text-muted-foreground" />
          <p className="text-sm font-medium text-foreground mt-3">No calls yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Once the receptionist is answering, every call shows up here with
            what was said, what came of it, and what it cost.
          </p>
          <Link
            href="/app/settings/voice"
            className="inline-block mt-4 px-5 py-2.5 rounded-full bg-inverted text-inverted-foreground text-sm font-semibold"
          >
            Set up the receptionist
          </Link>
        </div>
      )}

      {flagged.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-2">
            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400" />
            Needs you ({flagged.length})
          </h2>
          <div className="space-y-2">
            {flagged.map((c) => (
              <CallRow
                key={c.id}
                call={c}
                urgent
                busy={busy === c.id}
                onSeen={() => markSeen(c.id)}
                formatDateTime={formatDateTime}
              />
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          {flagged.length > 0 && (
            <h2 className="text-sm font-bold text-foreground mb-2">Everything else</h2>
          )}
          <div className="space-y-2">
            {rest.map((c) => (
              <CallRow key={c.id} call={c} formatDateTime={formatDateTime} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CallRow({ call, urgent, busy, onSeen, formatDateTime }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        urgent
          ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
          : "border-border bg-card"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* Which way the call went. An outbound row without this reads as a
            customer who rang — but it's a call the assistant placed, and the
            summary ("confirmed the quote") only makes sense with the arrow. */}
        {call.direction === "outbound" && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
            <PhoneOutgoing size={11} /> We called
          </span>
        )}
        <span className="font-semibold text-foreground tabular-nums">
          {call.from || "Unknown number"}
        </span>
        <span className="text-xs text-muted-foreground">
          {call.at ? formatDateTime(call.at) : ""}
        </span>
        <span className="text-xs text-muted-foreground">{duration(call.durationSec)}</span>
        <span className="text-xs text-muted-foreground">{money(call.costCents)}</span>
      </div>

      {call.summary && <p className="text-sm text-foreground mt-2">{call.summary}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* What the call PRODUCED, linked. A summary is useful; the lead it
            created is the thing somebody actually has to act on. */}
        {/* /app/leads, not /app/leads/<id> — there IS no lead detail route,
            and a link to one would 404. The list is where a lead is worked
            from, so that's where this goes. */}
        {call.leadId && (
          <Link
            href="/app/leads"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-muted"
          >
            <UserPlus size={13} /> Saved as a lead
          </Link>
        )}
        {call.bookingId && (
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
            <CalendarCheck size={13} /> Booked a visit
          </span>
        )}
        {call.recordingUrl && (
          <a
            href={call.recordingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-muted"
          >
            <Play size={13} /> Listen
          </a>
        )}

        {urgent && (
          <button
            type="button"
            disabled={busy}
            onClick={onSeen}
            className="ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-inverted text-inverted-foreground font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            I&apos;ve dealt with it
          </button>
        )}
      </div>
    </div>
  );
}
