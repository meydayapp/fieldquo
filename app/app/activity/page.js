// app/app/activity/page.js
//
// The company's activity log — a plain, readable trail of who did what.
// Owner/admin only (the API enforces it too). Deliberately simple: this is a
// record to consult when something looks wrong, not a dashboard.
//
// ── What a row says, and in which language ─────────────────────────────────
//
// `summary` is a sentence somebody wrote at the moment the action happened,
// stored in English. A row from March says what it said in March and this
// screen renders it verbatim — a log that changes retroactively is not a log,
// and rewriting stored rows would be editing the customer's own records.
//
// A row written since lib/activity/log.js grew `summaryKey` also carries a
// catalogue key and its parameters, and THAT is rendered in the reader's
// language. So the log translates forward, never backward, and a mixed list is
// the honest picture of a company's history rather than a retouched one.
"use client";

import { useEffect, useState } from "react";
import { Loader2, Activity as ActivityIcon, ShieldAlert } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatShortDate } from "@/lib/format/localeDate";

import { useTranslation } from "@/app/hooks/useTranslation";
// Small dot colour per action family, so the eye can scan for deletes/payments.
function toneFor(action) {
  if (action.includes("deleted")) return "bg-red-500";
  // Revoking someone's access and approving your own hours are the two entries
  // an owner scanning this page is most likely to be looking FOR. Both used to
  // be absent entirely; arriving as an unremarkable grey dot would be the
  // quieter version of the same problem.
  if (action === "member.deactivated") return "bg-red-500";
  if (action === "timeEntry.selfApproved") return "bg-amber-500";
  if (action.includes("payment")) return "bg-green-500";
  if (action.includes("sent")) return "bg-blue-500";
  if (action.startsWith("settings")) return "bg-amber-500";
  return "bg-muted-foreground";
}

/**
 * "just now" / "4m ago" / "3d ago", in the reader's language.
 *
 * Intl.RelativeTimeFormat rather than nine sets of "{n}m ago": the unit
 * abbreviations and their word order are CLDR's job, and every runtime already
 * has them. The English version also fell off a cliff at 30 days into
 * `toLocaleDateString()` with NO locale argument, which uses the BROWSER's —
 * so a Spanish interface on an English-locale laptop printed "9/10/2026"
 * beside translated copy. The interface language is the statement the user
 * made; the OS language is not. Past 30 days it hands off to
 * lib/format/localeDate.js, which is where every other back-office date goes.
 */
function timeAgo(iso, language) {
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  let rtf;
  try {
    rtf = new Intl.RelativeTimeFormat(language, {
      numeric: "auto",
      style: "narrow",
    });
  } catch {
    rtf = null;
  }
  // `numeric: "auto"` is what turns -0 seconds into "now" rather than "0
  // seconds ago" — and into "ahora" / "maintenant" without a second table.
  if (!rtf) return formatShortDate(iso, language);
  if (s < 60) return rtf.format(0, "second");
  const m = Math.round(s / 60);
  if (m < 60) return rtf.format(-m, "minute");
  const h = Math.round(m / 60);
  if (h < 24) return rtf.format(-h, "hour");
  const d = Math.round(h / 24);
  if (d < 30) return rtf.format(-d, "day");
  return formatShortDate(iso, language);
}

export default function ActivityPage() {
  const { t, language } = useTranslation();
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJson("/api/activity")
      .then((d) => setEntries(d.entries))
      .catch((e) => setError(e.message || t("app.activity.loadError")));
    // `t` is stable per language and this load is not language-dependent;
    // re-running it on a language switch would refetch the whole log to change
    // one error string that is almost never on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-2 mb-1">
        <ActivityIcon size={20} className="text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">{t("app.activity.title")}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-xl">
        {/* This claimed to cover "important actions" while missing every
            action with money attached: hours created and approved, expenses,
            team access changes, client contact edits. Those are logged now, so
            the sentence lists them by name rather than gesturing at a category
            — a promise this page can actually keep. */}
        {t("app.activity.intro")}
      </p>

      {error && (
        <p className="text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {!entries && !error && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" /> {t("app.state.loading")}
        </div>
      )}

      {entries && entries.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("app.activity.empty")}
        </div>
      )}

      {entries && entries.length > 0 && (
        <ul className="rounded-xl border border-border bg-card divide-y divide-border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-3">
              <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${toneFor(e.action)}`} />
              <div className="min-w-0 flex-1">
                {/* `summary` is the sentence a human wrote at the call site
                    (every recordActivity() in the codebase passes one). A row
                    old enough to predate that falls back to the raw action
                    KEY — "timeEntry.selfApproved" — which is a machine name,
                    not English, and reads as a bug when it is set in the same
                    type as a sentence. Shown as what it is instead. */}
                {e.summary ? (
                  <p className="text-sm text-foreground">
                    {/* The stored English is the FALLBACK, which is exactly
                        right: a row written before summaryKey existed has no
                        key, t() falls through to it, and history reads as it
                        was written. */}
                    {e.summaryKey
                      ? t(e.summaryKey, e.summary, e.summaryParams || {})
                      : e.summary}
                  </p>
                ) : (
                  <p className="text-xs font-mono text-muted-foreground">{e.action}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>{e.actorName || t("app.activity.someone")}</span>
                  {e.actorRole && <span className="text-muted-foreground/70">· {e.actorRole}</span>}
                  <span>· {timeAgo(e.createdAt, language)}</span>
                  {e.viaImpersonation && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <ShieldAlert size={12} /> {t("app.activity.supportSession")}
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
