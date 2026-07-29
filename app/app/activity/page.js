// app/app/activity/page.js
//
// The company's activity log — a plain, readable trail of who did what.
// Owner/admin only (the API enforces it too). Deliberately simple: this is a
// record to consult when something looks wrong, not a dashboard.
"use client";

import { useEffect, useState } from "react";
import { Loader2, Activity as ActivityIcon, ShieldAlert } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

// Small dot colour per action family, so the eye can scan for deletes/payments.
function toneFor(action) {
  if (action.includes("deleted")) return "bg-red-500";
  if (action.includes("payment")) return "bg-green-500";
  if (action.includes("sent")) return "bg-blue-500";
  if (action.startsWith("settings")) return "bg-amber-500";
  return "bg-muted-foreground";
}

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ActivityPage() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJson("/api/activity")
      .then((d) => setEntries(d.entries))
      .catch((e) => setError(e.message || "Could not load activity"));
  }, []);

  return (
    <div className="max-w-3xl px-6 py-8">
      <div className="flex items-center gap-2 mb-1">
        <ActivityIcon size={20} className="text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-xl">
        A record of important actions in your account — quotes sent, payments
        recorded, clients or quotes deleted, pricing and settings changes. Kept
        so you can always see who did what.
      </p>

      {error && (
        <p className="text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {!entries && !error && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      )}

      {entries && entries.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No activity recorded yet.
        </div>
      )}

      {entries && entries.length > 0 && (
        <ul className="rounded-xl border border-border bg-card divide-y divide-border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-3">
              <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${toneFor(e.action)}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{e.summary || e.action}</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>{e.actorName || "Someone"}</span>
                  {e.actorRole && <span className="text-muted-foreground/70">· {e.actorRole}</span>}
                  <span>· {timeAgo(e.createdAt)}</span>
                  {e.viaImpersonation && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <ShieldAlert size={12} /> support session
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
