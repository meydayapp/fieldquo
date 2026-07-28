// app/components/ImpersonationBanner.js
//
// Persistent bar shown while a platform superadmin is viewing a customer's
// account read-only.
//
// Not decoration. Without it the app looks identical to a normal session, and
// the most likely support mistake becomes "I thought I was in my own account"
// — followed by confusion when every button 403s. The bar states whose
// account it is, that nothing can be changed, how long is left, and offers one
// obvious way out.
"use client";

import { useEffect, useState } from "react";
import { Eye, X, Loader2 } from "lucide-react";

export default function ImpersonationBanner() {
  const [session, setSession] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/impersonation/status");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.active) {
          setSession(data);
          setRemaining(data.expiresInSeconds);
        }
      } catch {
        // A failure here means no banner. Acceptable: the read-only
        // enforcement lives in middleware, not in this component.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (remaining == null) return;
    const t = setInterval(() => {
      setRemaining((r) => (r == null || r <= 0 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [remaining != null]);

  if (!session) return null;

  async function leave() {
    setLeaving(true);
    await fetch(`/api/platform/companies/${session.companyId}/impersonate`, {
      method: "DELETE",
    }).catch(() => {});
    window.location.href = `/platform/companies/${session.companyId}`;
  }

  const mins = Math.floor((remaining || 0) / 60);
  const secs = String((remaining || 0) % 60).padStart(2, "0");
  const expired = (remaining || 0) <= 0;

  return (
    <div className="sticky top-0 z-50 bg-amber-500 text-[#2d2520]">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 flex-wrap text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Eye size={15} className="shrink-0" />
          <span className="font-semibold truncate">
            Viewing {session.companyName}
          </span>
          <span className="opacity-80">· read-only, nothing can be changed</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="tabular-nums opacity-80">
            {expired ? "Session expired" : `${mins}:${secs} left`}
          </span>
          <button
            onClick={leave}
            disabled={leaving}
            className="inline-flex items-center gap-1.5 bg-[#2d2520] text-white px-3 py-1 rounded-full text-xs font-semibold disabled:opacity-60"
          >
            {leaving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <X size={12} />
            )}
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
