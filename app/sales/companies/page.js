// app/sales/companies/page.js
//
// A rep's own book: every company attributed to them, and what it is doing.
//
// ══ Why this is no longer the portal's front door ════════════════════════
//
// It was `/sales` until 2026-09-03, which meant a rep opening the portal
// landed on a commission-history table. That is a reference, not a next
// action: it answers "did the ones I closed stick?", which matters at the end
// of a month and not at 9am with a phone in hand. The front door is now the
// Today screen in app/sales/page.js, and this moved down one tab rather than
// growing a scoreboard on top of it — a page that answers two unrelated
// questions ends up answering neither well.
//
// Nothing about the screen itself changed in the move. It keeps its
// translation keys, so a French rep still reads it in French; the Today screen
// in front of it is English, like the queue, leads, threads and notes screens
// it sits beside (docs/sales-intel/STATUS.md records why).
//
// ══ What is on this screen, and what is not ══════════════════════════════
//
// Name, signup date, subscription status, whether Stripe has let them start
// taking money, and which commission milestones have actually been recorded.
// That is the complete list, and it is the same list as REP_COMPANY_SELECT in
// lib/sales/scope.js — because a rep is paid on whether a company activated,
// subscribed and stayed, and nothing else answers that.
//
// NOT here: the contractor's quotes, clients, revenue, job costing, phone
// numbers or documents. None of them bear on a commission, and all of them
// belong to the contractor. A rep is FieldQuo staff, not staff of the company
// they sold to.
//
// ══ Nothing on this page writes ══════════════════════════════════════════
//
// There is no button here that changes anything, which is the honest shape
// rather than a limitation: /api/sales refuses every non-read method before a
// handler sees it (lib/sales/gate.js), so a control that appeared to correct an
// attribution would be a control that 403s. When corrections ship they belong
// on the superadmin's screen, where the audit row can be written beside them.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, CheckCircle2, CircleDashed } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

// Literal keys in a lookup table rather than a key built by concatenating a
// prefix onto the milestone name, so check-translations.mjs can see them. Its
// own header says computed keys are invisible to that scan, and a milestone
// label that renders as its own key is exactly the failure it exists for.
// (The comment is careful not to spell such a key out either — the scan reads
// source text, comments included, so an example in prose would be reported as
// an undefined key. It was, on the first run.)
// The middle key still says FirstPayment and its translations now say
// "Renewed", in every language the portal ships. That is deliberate and matches the decision in
// lib/sales/commission.js: milestone 2 stopped meaning "a payment landed" and
// started meaning "the company reached its next billing cycle, free or paid",
// but the STORED milestone value is `first_payment` on rows that have already
// paid people. Renaming the message key would only rename it here — what a rep
// reads is the value, and the value is what changed.
const MILESTONE_KEYS = {
  activation: "app.salesPortal.milestoneActivation",
  first_payment: "app.salesPortal.milestoneFirstPayment",
  retention: "app.salesPortal.milestoneRetention",
};

const SUBSCRIPTION_KEYS = {
  trialing: "app.salesPortal.subTrialing",
  active: "app.salesPortal.subActive",
  past_due: "app.salesPortal.subPastDue",
  canceled: "app.salesPortal.subCanceled",
};

export default function SalesPortalPage() {
  const { t, language } = useTranslation();
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/api/sales/companies");
      setCompanies(data.companies || []);
    } catch (err) {
      // The failed load replaces the list rather than sitting beside an empty
      // state — lib/loadState.js's rule: "0 companies" next to a red banner is
      // the real bug, because one of the two is a lie.
      setCompanies(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString(language, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.salesPortal.myCompanies")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {t("app.salesPortal.intro")}
        </p>
      </div>

      {error && (
        <div className="bg-card border border-border rounded-xl p-4 text-sm text-foreground flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
          <div className="min-w-0">
            <p>{error}</p>
            {/* min-h-[44px], not the bare underline this used to be: it was
                the one control on the screen and it was 20px tall, which is
                the target a wet thumb in a van misses. */}
            <button
              onClick={load}
              className="mt-2 min-h-[44px] inline-flex items-center text-sm font-semibold underline underline-offset-2"
            >
              {t("app.salesPortal.retry")}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          {t("app.salesPortal.loading")}
        </div>
      )}

      {!loading && companies && companies.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          {t("app.salesPortal.empty")}
        </div>
      )}

      {!loading && companies && companies.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">
                    {t("app.salesPortal.colCompany")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("app.salesPortal.colSignedUp")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("app.salesPortal.colSubscription")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("app.salesPortal.colMilestones")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{c.name}</span>
                      {c.isDemo && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                          {t("app.salesPortal.demoBadge")}
                        </span>
                      )}
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        {c.chargesEnabled ? (
                          <>
                            <CheckCircle2 size={12} className="shrink-0" />
                            {t("app.salesPortal.chargesEnabled")}
                          </>
                        ) : (
                          <>
                            <CircleDashed size={12} className="shrink-0" />
                            {t("app.salesPortal.chargesPending")}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(c.signedUpAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {c.subscriptionStatus &&
                      SUBSCRIPTION_KEYS[c.subscriptionStatus]
                        ? t(SUBSCRIPTION_KEYS[c.subscriptionStatus])
                        : t("app.salesPortal.subNone")}
                    </td>
                    <td className="px-4 py-3">
                      {/* An empty ledger renders as "none recorded", not as
                          three greyed-out "not yet" pills. A milestone that
                          nothing has written is an absent statement, and
                          drawing a timeline for it invents one. */}
                      {c.milestones.length === 0 ? (
                        <span className="text-muted-foreground">
                          {t("app.salesPortal.noMilestones")}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {c.milestones.map((m, i) => (
                            <span
                              key={`${m.milestone}-${i}`}
                              className="text-xs px-2 py-0.5 rounded-full border border-border text-foreground"
                            >
                              {MILESTONE_KEYS[m.milestone]
                                ? t(MILESTONE_KEYS[m.milestone])
                                : m.milestone}
                              {m.status === "reversed" &&
                                ` · ${t("app.salesPortal.statusReversed")}`}
                              {m.status === "under_review" &&
                                ` · ${t("app.salesPortal.statusUnderReview")}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
