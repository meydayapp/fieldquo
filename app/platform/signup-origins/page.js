// app/platform/signup-origins/page.js
//
// Where every signup came from, and which ones need a look.
//
// ══ Why this screen exists ═════════════════════════════════════════════════
//
// The owner: "check if the IP of the company or person that signed up is from
// Canada or USA, and flag when it isn't — a first-level flag in /platform for
// suspicious activity", above all for signups that came through a sales rep's
// link. Every row is one company: the request's IP and what Vercel's edge
// said about it (country / region / city), the browser, which door it walked
// in (rep link, referral, promo, direct), and the flag decided at the time by
// lib/platform/signupFlags.js — never re-derived here.
//
// A flag is a reason to LOOK, not a verdict. "Under review → Reviewed" with a
// note is the whole workflow: nothing here suspends a company, and an unknown
// country is printed as unknown, never as suspicious.
//
// English only, like the rest of the console.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Globe, Loader2, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import SignupFlagChip from "@/app/components/platform/SignupFlagChip";
import { count } from "@/app/components/platform/MetricCard";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[40px] px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60";

function when(value) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

function ReviewForm({ row, onDone }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await fetchJson(`/api/platform/signup-origins/${row.id}/review`, {
        method: "POST",
        body: { note },
      });
      onDone(result.origin);
    } catch (err) {
      setError(err.message || "Couldn't mark it reviewed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-wrap gap-2 items-start">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What you found (optional)"
        maxLength={1000}
        className="flex-1 min-w-[200px] border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground"
      />
      <button type="submit" disabled={busy} className={`${BTN} bg-inverted text-inverted-foreground`}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
        Mark reviewed
      </button>
      {error && (
        <div className="basis-full text-xs text-red-700 dark:text-red-300" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}

export default function PlatformSignupOriginsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("flagged") === "1";
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson(`/api/platform/signup-origins${flaggedOnly ? "?flagged=1" : ""}`));
    } catch (err) {
      setError(err.message || "Couldn't load signups.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [flaggedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const origins = data?.origins || [];

  function replaceRow(updated) {
    setData((d) =>
      d
        ? {
            ...d,
            origins: d.origins.map((o) => (o.id === updated.id ? updated : o)),
            flaggedCount: Math.max(0, (d.flaggedCount || 0) - 1),
          }
        : d,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Signup origins</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Where each signup request came from — the IP, the country Vercel&apos;s
            edge placed it in, and which door it walked in. A signup from
            outside Canada and the US, one that disagrees with the country the
            company stated, or one sharing an address with another signup this
            month is flagged for a look. A flag is a reason to look, not a
            verdict; nothing here changes the company.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="inline-flex items-center gap-2 text-foreground">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => setFlaggedOnly(e.target.checked)}
            className="h-4 w-4"
          />
          Flagged only
        </label>
        {data && (
          <span className="text-xs text-muted-foreground">
            {count(data.flaggedCount)} waiting for review · {count(data.total)} signups recorded
            {data.truncated ? " · showing the newest 200" : ""}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : !data ? null : origins.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Globe size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            {flaggedOnly
              ? "Nothing is waiting for review."
              : "No signup has been recorded yet. Rows appear from the first signup after this shipped; earlier companies have no origin on file."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {origins.map((o) => (
            <div key={o.id} className="px-5 py-4 flex flex-wrap gap-4 justify-between" data-origin-row={o.id}>
              <div className="min-w-0 space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/platform/companies/${o.companyId}`}
                    className="font-medium text-foreground hover:underline truncate"
                  >
                    {o.companyName || o.companyId}
                  </Link>
                  {o.isDemo && (
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                      Demo
                    </span>
                  )}
                  <SignupFlagChip
                    flag={o.flag}
                    flagLabel={o.flagLabel}
                    reviewedAt={o.reviewedAt}
                    countryKnown={Boolean(o.ipCountry)}
                  />
                </div>

                <div className="text-sm text-foreground">
                  {o.ipCountry ? (
                    <>
                      {[o.ipCity, o.ipRegion, o.ipCountry].filter(Boolean).join(", ")}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Country unknown — no geo header on the request</span>
                  )}
                  {o.statedCountry && (
                    <span className="text-muted-foreground"> · stated {o.statedCountry}</span>
                  )}
                </div>

                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                  <span>
                    via {o.viaLabel}
                    {o.rep ? ` — ${o.rep.name} (${o.rep.code})` : ""}
                    {!o.rep && o.via === "sales_link" ? " — code did not attribute" : ""}
                    {o.referralCode ? ` · code ${o.referralCode}` : ""}
                  </span>
                  <span className="font-mono">{o.ip || "no IP on the request"}</span>
                  {o.acceptLanguage && <span>lang {o.acceptLanguage.split(",")[0]}</span>}
                </div>
                {o.userAgent && (
                  <div className="text-[11px] text-muted-foreground truncate max-w-xl" title={o.userAgent}>
                    {o.userAgent}
                  </div>
                )}
                {o.flagReason && (
                  <div className="text-xs text-foreground">{o.flagReason}</div>
                )}
                {o.reviewedAt ? (
                  <div className="text-xs text-emerald-800 dark:text-emerald-300">
                    Reviewed {when(o.reviewedAt)}
                    {o.reviewedBy ? ` by ${o.reviewedBy}` : ""}
                    {o.reviewNote ? ` — ${o.reviewNote}` : ""}
                  </div>
                ) : o.needsReview && data.canReview ? (
                  <ReviewForm row={o} onDone={replaceRow} />
                ) : o.needsReview ? (
                  <div className="text-xs text-muted-foreground">
                    Under review — an admin or superadmin marks it reviewed.
                  </div>
                ) : null}
              </div>

              <div className="text-right shrink-0 text-xs text-muted-foreground">
                <div className="text-sm text-foreground">Signed up {when(o.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
