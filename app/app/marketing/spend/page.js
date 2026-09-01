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
import { usePermissions } from "@/app/providers/PermissionProvider";
import { can } from "@/lib/permissions";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { fetchArray } from "@/lib/loadState";
import { fetchJson } from "@/lib/fetchJson";
import ListState from "@/app/components/ListState";

const PLATFORMS = ["facebook", "google", "tiktok", "pamphlet", "referral", "other"];

function emptyForm() {
  const today = new Date().toISOString().slice(0, 10);
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

export default function MarketingSpendPage() {
  const { t } = useTranslation();
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

  const load = useCallback(async () => {
    setErrorKey("");
    const [entriesResult, summaryResult] = await Promise.all([
      fetchArray("/api/marketing-spend"),
      fetchJson("/api/marketing-spend/summary").catch((err) => ({ __error: err.message })),
    ]);
    if (!entriesResult.aborted) {
      if (entriesResult.ok) setEntries(entriesResult.data);
      else setErrorKey(entriesResult.errorKey);
    }
    if (!summaryResult.__error) setSummary(summaryResult);
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

  async function handleDelete(id) {
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
  const currency = summary?.companyCurrency || "CAD";

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
      {summary && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
            <TrendingUp size={15} /> {t("app.marketingSpend.blendedTitle", "Blended cost per lead")}
          </div>
          {blended?.value != null ? (
            <>
              <div className="text-3xl font-bold text-foreground">
                {new Intl.NumberFormat(undefined, { style: "currency", currency }).format(blended.value)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("app.marketingSpend.blendedBody", {
                  spend: new Intl.NumberFormat(undefined, { style: "currency", currency }).format(summary.totals.spend),
                  leads: blended.sampleSize,
                })}
                {blended.excludedCount > 0 && (
                  <> {t("app.marketingSpend.blendedExcluded", { count: blended.excludedCount })}</>
                )}
              </p>
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
                    <td className="px-5 py-2.5">{new Intl.NumberFormat(undefined, { style: "currency", currency }).format(c.spend)}</td>
                    <td className="px-5 py-2.5">{c.leads || "—"}</td>
                    <td className="px-5 py-2.5">
                      {c.costPerLead != null ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(c.costPerLead) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary.excludedCurrencyMismatch?.count > 0 && (
            <div className="px-5 py-2.5 border-t border-border text-[11px] text-muted-foreground">
              {t("app.marketingSpend.currencyMismatchNote", {
                count: summary.excludedCurrencyMismatch.count,
              })}
            </div>
          )}
        </div>
      )}

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
                    <td className="px-4 py-2.5 whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
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
