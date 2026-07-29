// app/platform/companies/[id]/CompanyActivity.js
//
// Support's read-only view of a tenant's action trail. This is what answers
// "who deleted this client / who changed the price" — the question that had no
// answer anywhere before the ActivityLog existed. Read-only by construction:
// the platform console views everything and changes nothing.
"use client";

import { useEffect, useState } from "react";
import { Loader2, History, ShieldAlert } from "lucide-react";

function toneFor(action) {
  if (action.includes("deleted")) return "bg-red-500";
  if (action.includes("payment")) return "bg-green-500";
  if (action.includes("sent")) return "bg-blue-500";
  if (action.startsWith("settings")) return "bg-amber-500";
  return "bg-muted-foreground";
}

function fmt(iso) {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CompanyActivity({ companyId }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/platform/companies/${companyId}/activity`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error || `Request failed (${res.status}).`);
        }
        return res.json();
      })
      .then((d) => !cancelled && setEntries(d.entries))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <History size={16} className="text-muted-foreground" />
        Activity — who did what
      </h2>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!entries && !error && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={15} className="animate-spin" /> Loading…
        </div>
      )}
      {entries && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">No recorded activity yet.</p>
      )}

      {entries && entries.length > 0 && (
        <ul className="divide-y divide-border max-h-96 overflow-y-auto -mx-2">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-2 py-2.5">
              <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${toneFor(e.action)}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{e.summary || e.action}</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span>{e.actorName || "Someone"}</span>
                  {e.actorRole && <span>· {e.actorRole}</span>}
                  <span>· {fmt(e.createdAt)}</span>
                  {e.viaImpersonation && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <ShieldAlert size={12} /> via support
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
