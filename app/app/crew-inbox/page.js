"use client";

// app/app/crew-inbox/page.js
//
// What the crew texted in, and — the point of the page — the ones that need a
// person. A filed photo already lives on its job; here you see the exceptions:
// a "which job?" nobody answered (so pick it), and texts from numbers not on
// the roster (so you know who to add).
//
// Needs-you first, and it doesn't clear itself — same rule as the receptionist
// page. A pending photo sits at the top until someone files it.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  MessageSquare, AlertTriangle, Check, ImageIcon, HelpCircle, UserX, Loader2, Settings,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";

export default function CrewInboxPage() {
  const { formatDateTime } = useCompanyPreferences();
  const [messages, setMessages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/crew/messages");
    if (!res.ok) {
      await reportResponseError(res, "Couldn't load the crew inbox.");
      return;
    }
    setMessages((await res.json()).messages || []);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function fileTo(id, jobId) {
    setBusy(id);
    try {
      const res = await fetch("/api/crew/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, jobId }),
      });
      if (!res.ok) {
        await reportResponseError(res, "Couldn't file that.");
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
      </div>
    );
  }

  const list = messages || [];
  const pending = list.filter((m) => m.status === "pending");
  const unknown = list.filter((m) => m.status !== "pending" && !m.known);
  const rest = list.filter((m) => m.status !== "pending" && m.known);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[12rem]">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare size={22} /> Crew inbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Photos and updates your crew texted in. Filed ones are on their jobs.
          </p>
        </div>
        <Link
          href="/app/settings/voice"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted"
        >
          <Settings size={15} /> Set it up
        </Link>
      </div>

      {list.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <MessageSquare size={22} className="mx-auto text-muted-foreground" />
          <p className="text-sm font-medium text-foreground mt-3">Nothing yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            When your crew text photos or updates to your number, they show up
            here and file to the right job automatically.
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-2">
            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400" />
            Needs you — pick the job ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((m) => (
              <div key={m.id} className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                <MsgHeader m={m} formatDateTime={formatDateTime} />
                {m.body && <p className="text-sm text-foreground mt-2">{m.body}</p>}
                <Thumbs photos={m.photos} count={m.photoCount} />
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <HelpCircle size={12} /> Which job is this for?
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.candidates.map((c) => (
                      <button
                        key={c.jobId}
                        type="button"
                        disabled={busy === m.id}
                        onClick={() => fileTo(m.id, c.jobId)}
                        className="text-sm px-3 py-1.5 rounded-full border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {busy === m.id ? <Loader2 size={13} className="animate-spin" /> : c.name}
                      </button>
                    ))}
                    {m.candidates.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No job was on their schedule that day.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {unknown.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-2">
            <UserX size={15} className="text-muted-foreground" />
            From numbers not on your team ({unknown.length})
          </h2>
          <div className="space-y-2">
            {unknown.map((m) => (
              <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                <MsgHeader m={m} formatDateTime={formatDateTime} />
                {m.body && <p className="text-sm text-foreground mt-2">{m.body}</p>}
                <Thumbs photos={m.photos} count={m.photoCount} />
                <p className="text-xs text-muted-foreground mt-2">
                  Add this number to a crew member in{" "}
                  <Link href="/app/settings/team" className="underline">Team</Link> and
                  their texts will file automatically.
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-2">Filed</h2>
          <div className="space-y-2">
            {rest.map((m) => (
              <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                <MsgHeader m={m} formatDateTime={formatDateTime} />
                {m.body && <p className="text-sm text-foreground mt-1">{m.body}</p>}
                <Thumbs photos={m.photos} count={m.photoCount} />
                {m.filedTo && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2 flex items-center gap-1">
                    <Check size={12} /> Filed to {m.filedTo}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MsgHeader({ m, formatDateTime }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="font-semibold text-foreground">{m.crew || m.from}</span>
      {m.crew && <span className="text-xs text-muted-foreground tabular-nums">{m.from}</span>}
      <span className="text-xs text-muted-foreground">{m.at ? formatDateTime(m.at) : ""}</span>
      {m.photoCount > 0 && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <ImageIcon size={12} /> {m.photoCount}
        </span>
      )}
    </div>
  );
}

function Thumbs({ photos, count }) {
  if (!photos?.length) return null;
  return (
    <div className="flex gap-2 mt-2 flex-wrap">
      {photos.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={url}
          alt=""
          className="w-16 h-16 object-cover rounded-lg border border-border"
        />
      ))}
      {count > photos.length && (
        <span className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">
          +{count - photos.length}
        </span>
      )}
    </div>
  );
}
