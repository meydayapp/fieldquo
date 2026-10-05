// app/components/marketing/AdFunnel.js
//
// What the ad money bought, per source — Meta's conversations → real
// conversations → leads → quotes → won → invoiced — with FieldQuo's cost per
// real conversation and per lead beside Meta's own cost per conversation and
// per lead, each labelled whose it is (lib/analytics/adFunnel.js). On the
// Spend page and the KPI page; reads GET /api/marketing-spend/ad-funnel.
//
// Its own read and its own failure state: a funnel that could not be worked
// out says so with Retry, never a table of zeros.
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson, errorText } from "@/lib/fetchJson";

const SOURCE_KEYS = {
  facebook_ads: "app.adFunnel.source.facebookAds",
  instagram_ads: "app.adFunnel.source.instagramAds",
  whatsapp_ads: "app.adFunnel.source.whatsappAds",
  organic: "app.adFunnel.source.organic",
  all_ads: "app.adFunnel.source.allAds",
};

export default function AdFunnel({ currency, from = "", to = "", t }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      setData(await fetchJson(`/api/marketing-spend/ad-funnel?${params.toString()}`));
    } catch (err) {
      setError(errorText(t, err) || t("app.adFunnel.loadError"));
    } finally {
      setLoading(false);
    }
  }, [from, to, t]);

  useEffect(() => {
    load();
  }, [load]);

  const cur = data?.currency || currency || "CAD";
  const fmtMoney = (n) => (n == null ? "—" : new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(n));
  const fmtCount = (n) => (n == null ? "—" : new Intl.NumberFormat(undefined).format(n));

  const rows = data ? [...(data.sources || []), { ...(data.allAds || {}), source: "all_ads" }] : [];
  const all = data?.allAds || null;

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden" data-ad-funnel>
      <div className="px-5 py-4 border-b border-border">
        <div className="text-sm font-semibold text-foreground">{t("app.adFunnel.title")}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{t("app.adFunnel.subtitle")}</p>
      </div>

      {error && (
        <div className="px-5 py-4 text-sm text-foreground">
          {error}{" "}
          <button type="button" onClick={load} className="min-h-[44px] underline underline-offset-2 font-semibold">
            {t("app.load.retry")}
          </button>
        </div>
      )}
      {!error && loading && !data && <div className="px-5 py-4 animate-pulse h-16 bg-accent" />}

      {!error && data && (
        <>
          {/* The money row first: Meta's numbers and FieldQuo's, side by side. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
            <Stat label={t("app.adFunnel.metaCostPerConversation")} value={fmtMoney(all?.metaCostPerConversation)} hint={t("app.adFunnel.metaCount", { count: fmtCount(all?.metaConversations) })} />
            <Stat label={t("app.adFunnel.costPerRealConversation")} value={fmtMoney(all?.costPerRealConversation)} hint={t("app.adFunnel.ourCount", { count: fmtCount(all?.realConversations) })} strong />
            <Stat label={t("app.adFunnel.metaCostPerLead")} value={fmtMoney(all?.metaCostPerLead)} hint={t("app.adFunnel.metaCount", { count: fmtCount(all?.metaLeads) })} />
            <Stat label={t("app.adFunnel.costPerLead")} value={fmtMoney(all?.costPerLead)} hint={t("app.adFunnel.ourCount", { count: fmtCount(all?.leads) })} strong />
          </div>
          {data.spendMissing && <p className="px-5 py-2 text-xs text-muted-foreground border-t border-border">{t("app.adFunnel.spendMissing")}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-t border-border">
                  <th className="px-5 py-2 font-medium">{t("app.adFunnel.colSource")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("app.adFunnel.colMetaConversations")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("app.adFunnel.colThreads")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("app.adFunnel.colTapOnly")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("app.adFunnel.colReal")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("app.adFunnel.colLeads")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("app.adFunnel.colQuotes")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("app.adFunnel.colWon")}</th>
                  <th className="px-5 py-2 font-medium text-right">{t("app.adFunnel.colInvoiced")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.source} className={`border-t border-border ${r.source === "all_ads" ? "font-semibold" : ""}`}>
                    <td className="px-5 py-2 text-foreground">{t(SOURCE_KEYS[r.source] || "app.adFunnel.source.organic")}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{r.source === "all_ads" ? fmtCount(r.metaConversations) : "—"}</td>
                    <td className="px-3 py-2 text-right">{fmtCount(r.threads)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{fmtCount((r.tapOnly || 0) + (r.notRelevant || 0))}</td>
                    <td className="px-3 py-2 text-right">{fmtCount(r.realConversations)}</td>
                    <td className="px-3 py-2 text-right">{fmtCount(r.leads)}</td>
                    <td className="px-3 py-2 text-right">{fmtCount(r.quotes)}</td>
                    <td className="px-3 py-2 text-right">{fmtCount(r.won)}</td>
                    <td className="px-5 py-2 text-right">{fmtMoney(r.invoiced)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border space-y-1 text-xs text-muted-foreground">
            <p>{t("app.adFunnel.noteMeta")}</p>
            <p>{t("app.adFunnel.noteReal")}</p>
            <p>{t("app.adFunnel.notePerApp")}</p>
            {all?.unclassified > 0 && <p>{t("app.adFunnel.noteUnclassified", { count: all.unclassified })}</p>}
            {all?.inferredQuotes > 0 && <p>{t("app.marketingSpend.campaigns.inferredNote", { count: all.inferredQuotes })}</p>}
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value, hint, strong = false }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className={`text-lg ${strong ? "font-bold" : "font-semibold"} text-foreground`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}
