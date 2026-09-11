// app/app/marketing/spend/page.js
//
// The manual marketing-spend entry screen — the missing half of
// /api/marketing-spend, already fully CRUD'd and, until this page, called by
// nothing (docs/TODO.md, scripts/check-route-callers.mjs's NO_FRONT_DOOR
// used to name this exact gap). Closing it does three things at once:
//
//   1. The monthly digest's marketing section stops reporting $0 forever —
//      lib/ai/monthlyDigest.js reads MarketingSpend, and nothing wrote it.
//   2. Every channel in MarketingPlatform works here, not just Meta —
//      pamphlets and referral incentives included.
//   3. It's what the Meta sync writes INTO — see the "From Meta Ads" card
//      below, which is a read of the same rows, filtered by source.
//
// The blended cost-per-lead card is Level 1 from
// docs/META-ADS-INTEGRATION.md Part 2: spend over REAL LeadRequest counts,
// never per-channel, never implying attribution this product doesn't have.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, X, TrendingUp, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { can } from "@/lib/permissions";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { fetchArray } from "@/lib/loadState";
import { fetchJson } from "@/lib/fetchJson";
import ListState from "@/app/components/ListState";
import { formatDateOnly } from "@/lib/format/companyDate";
import { CurrencyNotes, excludedSentence } from "@/app/components/marketing/SpendCurrencyNotes";

const PLATFORMS = ["facebook", "google", "tiktok", "pamphlet", "referral", "other"];

function emptyForm() {
  // The user's own calendar day, not UTC's: toISOString at 9pm in Toronto is
  // already tomorrow, and the form would default to a date that hasn't
  // happened. (The stored value is still that day at UTC midnight — the two
  // axes meet at the "YYYY-MM-DD" string, which is the whole design.)
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return { platform: "facebook", campaignName: "", amount: "", date: today, leads: "", conversions: "", notes: "" };
}

function toFormValues(entry) {
  return {
    platform: entry.platform,
    campaignName: entry.campaignName || "",
    amount: String(entry.amount ?? ""),
    date: entry.date ? new Date(entry.date).toISOString().slice(0, 10) : "",
    leads: entry.leads ? String(entry.leads) : "",
    conversions: entry.conversions != null ? String(entry.conversions) : "",
    notes: entry.notes || "",
  };
}

// Every column reads one field off a campaignRollup row. `money` columns
// print "≈" when that campaign's spend includes a converted row; `rate`
// columns are four-place fractions printed as percentages; everything else
// is a count. A null anywhere prints "—": Meta did not report it, or there
// was nothing to divide by — never 0.
const CAMPAIGN_COLUMNS = [
  { key: "spend", label: "colSpend", fallback: "Spend", kind: "money" },
  { key: "impressions", label: "colImpressions", fallback: "Impressions", kind: "count" },
  { key: "reach", label: "colReach", fallback: "Daily reach, summed", kind: "count" },
  { key: "clicks", label: "colClicks", fallback: "Clicks", kind: "count" },
  { key: "linkClicks", label: "colLinkClicks", fallback: "Link clicks", kind: "count" },
  { key: "ctr", label: "colCtr", fallback: "CTR", kind: "rate" },
  { key: "cpc", label: "colCpc", fallback: "CPC", kind: "money" },
  { key: "messagingConversations", label: "colConversations", fallback: "Conversations", kind: "count" },
  { key: "costPerConversation", label: "colCostPerConversation", fallback: "Cost / conversation", kind: "money" },
  { key: "videoViews", label: "colVideoViews", fallback: "Video views", kind: "count" },
  { key: "postEngagements", label: "colEngagements", fallback: "Engagements", kind: "count" },
  { key: "leads", label: "colLeads", fallback: "Leads", kind: "count" },
  { key: "costPerLead", label: "colCostPerLead", fallback: "Cost / lead", kind: "money" },
  { key: "quotes", label: "colQuotes", fallback: "Quotes", kind: "count" },
  { key: "jobs", label: "colJobs", fallback: "Jobs", kind: "count" },
  { key: "revenue", label: "colRevenue", fallback: "Invoiced", kind: "money" },
];

function CampaignsSection({ id, campaigns, error, loading, currency, onRetry, t }) {
  const fmtMoney = (n, approximate) =>
    n == null ? "—" : `${approximate ? "≈ " : ""}${new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n)}`;
  const fmtCount = (n) => (n == null ? "—" : new Intl.NumberFormat(undefined).format(n));
  const fmtRate = (n) => (n == null ? "—" : new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 2 }).format(n));
  const cell = (c, col) => {
    const v = c[col.key];
    if (col.kind === "money") return fmtMoney(v, c.approximate);
    if (col.kind === "rate") return fmtRate(v);
    return fmtCount(v);
  };
  const rows = campaigns?.campaigns || [];

  return (
    <section id={id} className="bg-card border border-border rounded-xl overflow-hidden scroll-mt-4">
      <div className="px-5 py-3 border-b border-border">
        <div className="text-sm font-semibold text-foreground">{t("app.marketingSpend.campaigns.title", "Campaigns")}</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t(
            "app.marketingSpend.campaigns.subtitle",
            "Every Meta campaign FieldQuo has synced — what it cost, what Meta reports, and what became of the leads it sent you.",
          )}
        </p>
      </div>

      {error && (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          {t("app.marketingSpend.campaigns.unavailable", "The campaign figures couldn't be worked out just now.")}{" "}
          <button type="button" onClick={onRetry} className="underline font-medium">
            {t("app.load.retry")}
          </button>
        </p>
      )}

      {!error && loading && !campaigns && <div className="px-5 py-4 animate-pulse h-16 bg-accent" />}

      {!error && campaigns && rows.length === 0 && (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          {t(
            "app.marketingSpend.campaigns.empty",
            "No campaigns synced yet. Connect your Meta ad account and press Sync now to see them here.",
          )}
        </p>
      )}

      {!error && rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-5 py-2 font-medium">{t("app.marketingSpend.campaigns.colCampaign", "Campaign")}</th>
                  <th className="px-3 py-2 font-medium">{t("app.marketingSpend.campaigns.colObjective", "Objective")}</th>
                  {CAMPAIGN_COLUMNS.map((col) => (
                    <th key={col.key} className="px-3 py-2 font-medium text-right">
                      {t(`app.marketingSpend.campaigns.${col.label}`, col.fallback)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.campaignId} className="border-b border-border last:border-0 align-top">
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-foreground">{c.campaignName || c.campaignId}</div>
                      {c.days > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          {t("app.marketingSpend.campaigns.period", { first: formatDateOnly(c.firstDate), last: formatDateOnly(c.lastDate), days: c.days })}
                        </div>
                      )}
                      {/* The pinned rate refused this campaign's currency: its
                          money is "—" above and this says what is missing. */}
                      {c.spendExcluded && (
                        <div className="text-[11px] text-amber-700 dark:text-amber-400">
                          {excludedSentence(
                            t,
                            c.spendExcluded,
                            new Intl.NumberFormat(undefined, { style: "currency", currency: c.spendExcluded.currency }).format(c.spendExcluded.amount),
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {c.objectiveLabelKey
                        ? t(`app.marketingSpend.objective.${c.objectiveLabelKey}`, c.objective)
                        : c.objective || "—"}
                    </td>
                    {CAMPAIGN_COLUMNS.map((col) => (
                      <td key={col.key} className="px-3 py-2.5 text-right tabular-nums">
                        {cell(c, col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-border space-y-1">
            <p className="text-[11px] text-muted-foreground">
              {t(
                "app.marketingSpend.campaigns.leadsNote",
                "Leads are the Meta lead-form submissions FieldQuo received for that campaign. A homeowner who saw the ad and phoned is not counted, so cost per lead here is the most a lead-form lead cost you — the blended figure above is the whole picture.",
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t(
                "app.marketingSpend.campaigns.reachNote",
                "Reach is Meta's daily count added up across days — the same person on two days counts twice.",
              )}
            </p>
            <CurrencyNotes totals={campaigns.totals} t={t} />
          </div>
        </>
      )}
    </section>
  );
}

export default function MarketingSpendPage() {
  const { t } = useTranslation();
  // The company's own currency, from the provider that holds it for every
  // /app screen — not from the summary payload this table does not come from.
  const { currency: companyCurrency } = useCompanyPreferences();
  const caller = usePermissions();
  // Same coarse gate the manual CRUD routes now enforce server-side (see
  // app/api/marketing-spend/route.js's header) — falls open while the
  // provider hasn't resolved yet, matching PermissionProvider's own rule.
  const canManage = !caller?.role || can(caller.role, "user:manage");

  const [entries, setEntries] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [banner, setBanner] = useState("");
  const [summaryError, setSummaryError] = useState("");
  // Per-campaign figures — a third read, its own error state, for the same
  // reason the summary has one: a failed campaigns call must not look like
  // "no campaigns synced yet".
  const [campaigns, setCampaigns] = useState(null);
  const [campaignsError, setCampaignsError] = useState("");

  const load = useCallback(async () => {
    setErrorKey("");
    const [entriesResult, summaryResult, campaignsResult] = await Promise.all([
      fetchArray("/api/marketing-spend"),
      fetchJson("/api/marketing-spend/summary").catch((err) => ({ __error: err.message })),
      fetchJson("/api/marketing-spend/campaigns").catch((err) => ({ __error: err.message })),
    ]);
    if (!entriesResult.aborted) {
      if (entriesResult.ok) setEntries(entriesResult.data);
      else setErrorKey(entriesResult.errorKey);
    }
    // The sentinel used to be captured and then never read again, so a failed
    // summary just made the blended cost-per-lead card and the by-channel
    // table VANISH — indistinguishable from "no data yet", with no retry
    // because errorKey is only set from the entries leg.
    if (summaryResult.__error) {
      setSummary(null);
      setSummaryError(summaryResult.__error);
    } else {
      setSummary(summaryResult);
      setSummaryError("");
    }
    if (campaignsResult.__error) {
      setCampaigns(null);
      setCampaignsError(campaignsResult.__error);
    } else {
      setCampaigns(campaignsResult);
      setCampaignsError("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setFormError("");
    setShowForm(true);
  }
  function openEdit(entry) {
    setForm(toFormValues(entry));
    setEditingId(entry.id);
    setFormError("");
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    const amountNum = Number(form.amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      setFormError(t("app.marketingSpend.amountInvalid", "Enter a valid amount, 0 or more."));
      return;
    }
    if (!form.date) {
      setFormError(t("app.marketingSpend.dateRequired", "A date is required."));
      return;
    }
    setSaving(true);
    try {
      const body = {
        platform: form.platform,
        campaignName: form.campaignName.trim() || null,
        amount: amountNum,
        date: form.date,
        leads: form.leads ? Number(form.leads) : 0,
        conversions: form.conversions ? Number(form.conversions) : null,
        notes: form.notes.trim() || null,
      };
      await fetchJson(editingId ? `/api/marketing-spend/${editingId}` : "/api/marketing-spend", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── A trash icon is not a confirmation ───────────────────────────────────
  //
  // This fired an immediate DELETE from a small icon on a table row, with no
  // step in between and no undo behind it. Every other destructive path in
  // these files has at least a modal. A spend row is hand-entered history that
  // the blended cost-per-lead figure above is computed from, so losing one
  // silently changes a number somebody is about to make a decision on.
  async function handleDelete(id) {
    if (
      !window.confirm(
        t(
          "app.marketingSpend.confirmDelete",
          "Delete this spend entry? The cost-per-lead figures above are worked out from these rows.",
        ),
      )
    ) {
      return;
    }
    try {
      await fetchJson(`/api/marketing-spend/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setBanner(err.message);
    }
  }

  const sortedEntries = useMemo(() => (entries ?? []).slice().sort((a, b) => new Date(b.date) - new Date(a.date)), [entries]);

  if (!canManage) return <NoAccessPanel capability="accessLevel" />;

  const blended = summary?.blendedCostPerLead;
  // ── The entries table was labelled CAD whenever the SUMMARY failed ───────
  //
  // `summary?.companyCurrency || "CAD"` fell back on a payload this table does
  // not come from: the rows load from GET /api/marketing-spend and the
  // currency came from GET /api/marketing-spend/summary, so a Swiss company
  // whose summary 500s saw every real spend row rendered as CA$.
  //
  // The currency is a company-level fact and CompanyPreferencesProvider exists
  // to hold it for exactly this — see its header. It is `null` there when the
  // company has none, which is honest, and formatMoney handles that; guessing
  // Canada is what put the wrong symbol on the screen.
  const currency = summary?.companyCurrency || companyCurrency;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.marketingSpend.title", "Marketing Spend")}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            {t(
              "app.marketingSpend.subtitle",
              "What you spend to bring in work, by channel — and what it costs you per lead, blended across everything.",
            )}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold shrink-0"
        >
          <Plus size={14} /> {t("app.marketingSpend.addEntry", "Log spend")}
        </button>
      </div>

      {banner && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <span className="flex-1">{banner}</span>
          <button onClick={() => setBanner("")} aria-label={t("app.action.close", "Close")}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Blended cost-per-lead — Level 1, honest by construction: real spend
          over real LeadRequest counts, never a per-channel figure. */}
      {/* The summary failed. Said out loud with a retry, because the absence of
          this card and the by-channel table below is indistinguishable from
          "you have not spent anything yet" — and the error key was already
          being captured into a sentinel that nothing read. */}
      {summaryError && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
            <TrendingUp size={15} /> {t("app.marketingSpend.blendedTitle", "Blended cost per lead")}
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              "app.marketingSpend.summaryUnavailable",
              "These figures couldn't be worked out just now. Nothing has been lost — the spend you have entered is listed below.",
            )}{" "}
            <button type="button" onClick={load} className="underline font-medium">
              {t("app.load.retry")}
            </button>
          </p>
        </div>
      )}

      {summary && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
            <TrendingUp size={15} /> {t("app.marketingSpend.blendedTitle", "Blended cost per lead")}
          </div>
          {blended?.value != null ? (
            <>
              {/* "≈" when the spend behind this figure includes rows converted
                  from another currency at the pinned rate — see
                  lib/analytics/spendCurrency.js. The note under the by-channel
                  table names the amount and the rate's age. */}
              <div className="text-3xl font-bold text-foreground">
                {summary.totals.approximate ? "≈ " : ""}
                {new Intl.NumberFormat(undefined, { style: "currency", currency }).format(blended.value)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("app.marketingSpend.blendedBody", {
                  spend: `${summary.totals.approximate ? "≈ " : ""}${new Intl.NumberFormat(undefined, { style: "currency", currency }).format(summary.totals.spend)}`,
                  leads: blended.sampleSize,
                })}
                {blended.excludedCount > 0 && (
                  <> {t("app.marketingSpend.blendedExcluded", { count: blended.excludedCount })}</>
                )}
              </p>
              <CurrencyNotes totals={summary.totals} t={t} />
              <p className="text-[11px] text-muted-foreground/80 mt-2 italic">
                {t(
                  "app.marketingSpend.blendedDisclaimer",
                  "Across everything you're doing to generate leads — this can't say which channel is working, only what the whole picture costs.",
                )}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {blended?.reason === "no_leads_in_period"
                ? t("app.marketingSpend.blendedNoLeads", "No leads came in during this period yet.")
                : t("app.marketingSpend.blendedUnavailable", "Not enough data yet.")}
            </p>
          )}
        </div>
      )}

      {/* Per-channel table — spend, self-reported leads (as entered, not
          computed), never divided against the real lead count above. */}
      {summary?.channels?.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-sm font-semibold text-foreground">
            {t("app.marketingSpend.byChannel", "Spend by channel")}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-5 py-2 font-medium">{t("app.marketingSpend.colChannel", "Channel")}</th>
                  <th className="px-5 py-2 font-medium">{t("app.marketingSpend.colSpend", "Spend")}</th>
                  <th className="px-5 py-2 font-medium">{t("app.marketingSpend.colLeadsEntered", "Leads (as entered)")}</th>
                  <th className="px-5 py-2 font-medium">{t("app.marketingSpend.colCplEntered", "Cost/lead (as entered)")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.channels.map((c) => (
                  <tr key={c.platform} className="border-b border-border last:border-0">
                    <td className="px-5 py-2.5 capitalize">{t(`app.marketingSpend.platform.${c.platform}`, c.platform)}</td>
                    <td className="px-5 py-2.5">
                      {c.approximate ? "≈ " : ""}
                      {new Intl.NumberFormat(undefined, { style: "currency", currency }).format(c.spend)}
                    </td>
                    {/* `c.leads || "—"` printed a deliberately-entered 0 as
                        "—", i.e. as unknown — and MarketingSpend.leads is
                        `Int @default(0)`, so a channel nobody filled in reads 0
                        as well. The column cannot tell those apart (noted in
                        the report); what this screen CAN stop doing is turning
                        a real zero into a dash. 0 is a finite number and a real
                        answer. */}
                    <td className="px-5 py-2.5 tabular-nums">
                      {Number.isFinite(Number(c.leads)) ? Number(c.leads) : "—"}
                    </td>
                    <td className="px-5 py-2.5">
                      {c.costPerLead != null ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(c.costPerLead) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* What was converted into the "≈" rows above, and what was refused.
              This used to say "shown separately, not blended" — and the only
              real ad spend in the system was shown nowhere the totals were. */}
          {(summary.totals?.approximate || summary.totals?.excluded?.length > 0) && (
            <div className="px-5 py-2.5 border-t border-border">
              <CurrencyNotes totals={summary.totals} t={t} />
            </div>
          )}
        </div>
      )}

      {/* ── Campaigns ──────────────────────────────────────────────────────
          One row per Meta campaign: what it cost, what Meta reports it did,
          and what FieldQuo can prove it became — lib/analytics/campaignRollup.js.
          The id is a link target: the KPI page's marketing tile and the Meta
          Ads settings panel both point at #campaigns. Always rendered once
          the page has loaded, so the anchor exists even before the first
          sync — an empty state is honest; a missing section is a dead link. */}
      <CampaignsSection
        id="campaigns"
        campaigns={campaigns}
        error={campaignsError}
        loading={loading}
        currency={currency}
        onRetry={load}
        t={t}
      />

      {/* Meta Ads connection pointer — the import lives in Settings, this is
          just a link so the two halves of the feature find each other. */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("app.marketingSpend.metaPointer", "Running ads on Meta? Connect your ad account to import spend automatically.")}
        </p>
        <Link
          href="/app/settings/meta-ads"
          className="flex items-center gap-1.5 text-sm font-semibold text-foreground border border-border rounded-full px-3.5 py-2 shrink-0"
        >
          {t("app.marketingSpend.metaPointerLink", "Meta Ads settings")} <ExternalLink size={13} />
        </Link>
      </div>

      {/* Entry list */}
      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={load}
        isEmpty={sortedEntries.length === 0}
        empty={
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <p className="text-sm text-muted-foreground">{t("app.marketingSpend.empty", "No spend logged yet.")}</p>
          </div>
        }
      >
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">{t("app.marketingSpend.colDate", "Date")}</th>
                  <th className="px-4 py-2 font-medium">{t("app.marketingSpend.colChannel", "Channel")}</th>
                  <th className="px-4 py-2 font-medium">{t("app.marketingSpend.colCampaign", "Campaign")}</th>
                  <th className="px-4 py-2 font-medium">{t("app.marketingSpend.colSpend", "Spend")}</th>
                  <th className="px-4 py-2 font-medium">{t("app.marketingSpend.colSource", "Source")}</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0">
                    {/* A spend entry is a calendar day stored at UTC midnight (the
                        route parses "YYYY-MM-DD" as such, and the edit form reads it
                        back with toISOString). toLocaleDateString read that instant in
                        the browser's zone, which west of Greenwich is the evening
                        BEFORE — every entry rendered a day early. Read the UTC day. */}
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDateOnly(entry.date)}</td>
                    <td className="px-4 py-2.5 capitalize">{t(`app.marketingSpend.platform.${entry.platform}`, entry.platform)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{entry.campaignName || "—"}</td>
                    <td className="px-4 py-2.5">
                      {entry.currency && entry.currency !== currency
                        ? new Intl.NumberFormat(undefined, { style: "currency", currency: entry.currency }).format(entry.amount)
                        : new Intl.NumberFormat(undefined, { style: "currency", currency }).format(entry.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          entry.source === "meta_api"
                            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t(entry.source === "meta_api" ? "app.marketingSpend.sourceMeta" : "app.marketingSpend.sourceManual", entry.source)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {entry.source !== "meta_api" && (
                        <button onClick={() => openEdit(entry)} className="text-muted-foreground hover:text-foreground p-1" aria-label={t("app.action.edit", "Edit")}>
                          <Pencil size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(entry.id)} className="text-muted-foreground hover:text-red-600 p-1" aria-label={t("app.action.delete", "Delete")}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ListState>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">
                {editingId ? t("app.marketingSpend.editEntry", "Edit spend") : t("app.marketingSpend.addEntry", "Log spend")}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label={t("app.action.close", "Close")}>
                <X size={16} />
              </button>
            </div>

            {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

            <label className="block text-xs">
              <span className="text-muted-foreground">{t("app.marketingSpend.fieldChannel", "Channel")}</span>
              <select
                value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                className="w-full mt-1 border border-border rounded-lg px-2.5 py-2 text-sm bg-card"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {t(`app.marketingSpend.platform.${p}`, p)}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs">
                <span className="text-muted-foreground">{t("app.marketingSpend.fieldDate", "Date")}</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full mt-1 border border-border rounded-lg px-2.5 py-2 text-sm bg-card"
                  required
                />
              </label>
              <label className="block text-xs">
                <span className="text-muted-foreground">{t("app.marketingSpend.fieldAmount", "Amount")}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full mt-1 border border-border rounded-lg px-2.5 py-2 text-sm bg-card"
                  required
                />
              </label>
            </div>

            <label className="block text-xs">
              <span className="text-muted-foreground">{t("app.marketingSpend.fieldCampaign", "Campaign (optional)")}</span>
              <input
                type="text"
                value={form.campaignName}
                onChange={(e) => setForm((f) => ({ ...f, campaignName: e.target.value }))}
                className="w-full mt-1 border border-border rounded-lg px-2.5 py-2 text-sm bg-card"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs">
                <span className="text-muted-foreground">{t("app.marketingSpend.fieldLeads", "Leads it brought (optional)")}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.leads}
                  onChange={(e) => setForm((f) => ({ ...f, leads: e.target.value }))}
                  className="w-full mt-1 border border-border rounded-lg px-2.5 py-2 text-sm bg-card"
                />
              </label>
              <label className="block text-xs">
                <span className="text-muted-foreground">{t("app.marketingSpend.fieldConversions", "Conversions (optional)")}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.conversions}
                  onChange={(e) => setForm((f) => ({ ...f, conversions: e.target.value }))}
                  className="w-full mt-1 border border-border rounded-lg px-2.5 py-2 text-sm bg-card"
                />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground/80 -mt-1">
              {t(
                "app.marketingSpend.leadsHint",
                "Your own estimate for this channel — shown as \"as entered\", never combined with your real lead count.",
              )}
            </p>

            <label className="block text-xs">
              <span className="text-muted-foreground">{t("app.marketingSpend.fieldNotes", "Notes (optional)")}</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full mt-1 border border-border rounded-lg px-2.5 py-2 text-sm bg-card"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-full text-sm font-semibold disabled:opacity-50"
            >
              {saving ? t("app.action.saving", "Saving…") : t("app.action.save", "Save")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
