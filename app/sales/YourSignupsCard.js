// app/sales/YourSignupsCard.js
//
// "Your signups" on the rep's Today screen: every signup that came in on
// this rep's link — finished or not — with the same facts the owner reads on
// /platform/signups and the welcome-call opener to say when they pick up.
//
// Read from /api/sales/signups, which is scoped by the SalesAttribution row
// (finished) and by the SignupLead's referring rep (unfinished); a signup
// nobody referred is not in this list and reaches a rep only through their
// queue after the owner assigns it. Every sentence is a catalogue key; the
// opener itself is in the script's language (lib/sales/playbook/
// signupOpener.js), which is the lead's, not the rep's.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import SignupBadge, { signupFactText } from "@/app/components/sales/SignupBadge";

const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";
const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";

export default function YourSignupsCard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson("/api/sales/signups"));
    } catch (err) {
      setData(null);
      setError(err?.message || t("app.salesToday.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data ? [...(data.unfinished || []), ...(data.finished || [])] : [];

  return (
    <section className={CARD} data-your-signups>
      <h2 className="text-base font-semibold text-foreground">{t("app.signupLead.yours.title")}</h2>
      <p className="text-xs text-muted-foreground break-words">{t("app.signupLead.yours.intro")}</p>
      {error ? (
        <div className="flex items-start gap-2 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="min-w-0 space-y-2">
            <p className="text-foreground break-words">{error}</p>
            <button type="button" onClick={load} className={`${BTN} border border-border text-foreground`}>
              <RefreshCw size={15} /> {t("app.salesToday.tryAgain")}
            </button>
          </div>
        </div>
      ) : loading ? (
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground break-words">{t("app.signupLead.yours.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={`${r.kind}:${r.id}`} className="rounded-lg border border-border p-3 space-y-1" data-your-signup-row data-kind={r.kind}>
              <div className="flex flex-wrap items-center gap-2">
                <SignupBadge kind={r.badge} compact />
                <span className="text-sm font-medium text-foreground break-words">{r.name}</span>
              </div>
              {r.fact ? <p className="text-xs text-muted-foreground break-words">{signupFactText(r.fact, t)}</p> : null}
              {r.opener ? (
                <p className="text-sm text-foreground break-words" data-opener>
                  “{r.opener.say}”
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {r.leadId ? (
                  <Link href={`/sales/leads/${encodeURIComponent(r.leadId)}`} className={`${BTN} border border-border text-foreground px-3 min-h-[36px] py-1.5`}>
                    {t("app.signupLead.yours.openLead")}
                  </Link>
                ) : null}
                {r.kind !== "abandoned" ? (
                  <Link href="/sales/companies" className={`${BTN} border border-border text-foreground px-3 min-h-[36px] py-1.5`}>
                    {t("app.signupLead.yours.openCompany")}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
