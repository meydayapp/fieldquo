"use client";

// app/app/influencer/page.js
//
// The influencer's page: their link, the plan they earn under, the companies
// that came through the link, what they have earned, and where it goes.
//
// ══ Why this is the rep's Pay screen with a different header ══════════════
//
// The owner's brief: "in their /app they should have an Influencer page
// where they keep track the same way sales reps do on /sales/pay, and the
// same for how they need to be paid". So the two controls that make up
// /sales/pay — EarningsPanel and PayoutDestinationForm — render here
// unchanged, pointed at the company-gated routes under /api/influencer,
// which answer in the same shape from the same ledger functions. The prose
// around them is this screen's own, because an influencer has not been
// told what a "milestone" is and a rep has.
//
// ══ What it refuses to imply ══════════════════════════════════════════════
//
// A company in the list is one whose signup was ATTRIBUTED, not merely one
// that clicked. A plan of null is said to be null. No money moves from this
// page — a batch closes on a Monday and a human pays it — and the panel says
// "closed, not paid yet" rather than dressing that up.
import { useEffect, useState } from "react";
import { AlertCircle, Check, Copy, Link2 } from "lucide-react";

import EarningsPanel from "@/app/components/sales/EarningsPanel";
import PayoutDestinationForm from "@/app/components/sales/PayoutDestinationForm";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchJson } from "@/lib/fetchJson";
import { centsToMoney } from "@/lib/sales/money";

const STATUS_KEY = {
  signedUp: "app.influencer.status.signedUp",
  trial: "app.influencer.status.trial",
  paying: "app.influencer.status.paying",
  churned: "app.influencer.status.churned",
};

export default function InfluencerPage() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchJson("/api/influencer");
        if (!cancelled) setData(res);
      } catch (err) {
        if (cancelled) return;
        // 404 with notEnrolled is the route's honest "this company is not in
        // the programme" — a different sentence from a failed load.
        if (err?.status === 404 || err?.body?.notEnrolled) setNotEnrolled(true);
        else setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function copy() {
    if (!data?.referralUrl) return;
    navigator.clipboard?.writeText(data.referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl animate-pulse space-y-4">
        <div className="h-8 w-56 bg-accent rounded" />
        <div className="h-24 bg-accent rounded-xl" />
      </div>
    );
  }

  if (notEnrolled || failed || !data) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold text-foreground mb-3">{t("app.influencer.title")}</h1>
        <div className="rounded-xl border border-border bg-card p-4 flex gap-2 text-sm text-foreground">
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{notEnrolled ? t("app.influencer.notEnrolled") : t("app.influencer.loadFailed")}</span>
        </div>
      </div>
    );
  }

  const plan = data.plan;

  return (
    <div className="p-6 space-y-10 max-w-2xl">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">{t("app.influencer.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("app.influencer.intro")}</p>
      </header>

      {/* ── The link ─────────────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-5">
        <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
          <Link2 size={15} aria-hidden="true" />
          {t("app.influencer.linkTitle")}
        </label>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={data.referralUrl || ""}
            onFocus={(e) => e.target.select()}
            className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm bg-muted text-foreground"
          />
          <button
            type="button"
            onClick={copy}
            disabled={!data.referralUrl}
            className="flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-lg text-sm font-semibold shrink-0 disabled:opacity-50"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? t("app.influencer.copied") : t("app.influencer.copy")}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{t("app.influencer.linkHint")}</p>
      </section>

      {/* ── The plan ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">{t("app.influencer.planTitle")}</h2>
        {plan ? (
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            <p className="px-4 py-2 text-xs text-muted-foreground">
              {t("app.influencer.planName", { name: plan.name })}
            </p>
            {[
              [t("app.influencer.planActivation"), plan.activationCents],
              [t("app.influencer.planFirstPayment"), plan.firstPaymentCents],
              [t("app.influencer.planRetention", { days: plan.retentionDays }), plan.retentionCents],
            ].map(([label, cents]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm text-foreground">{label}</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">{centsToMoney(cents)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-200">
            {t("app.influencer.noPlan")}
          </div>
        )}
      </section>

      {/* ── The companies ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">{t("app.influencer.referredTitle")}</h2>
        {data.companies.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("app.influencer.referredEmpty")}</p>
        ) : (
          <ul className="rounded-xl border border-border bg-card divide-y divide-border">
            {data.companies.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("app.influencer.signedUpOn", { date: formatDate(c.signedUpAt) })}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                  {t(STATUS_KEY[c.status] || STATUS_KEY.signedUp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Earned / pending / paid, by week — the rep's own panel ───────── */}
      <EarningsPanel endpoint="/api/influencer/earnings" />

      {/* ── Where it goes ────────────────────────────────────────────────── */}
      <section className="border-t border-border pt-8 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">{t("app.influencer.payoutTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("app.influencer.payoutIntro")}</p>
        </div>
        {/* showEngagement off: "freelancer" was stated by the programme, not a
            decision this person needs to read back every visit. */}
        <PayoutDestinationForm endpoint="/api/influencer/payout" showEngagement={false} />
      </section>
    </div>
  );
}
