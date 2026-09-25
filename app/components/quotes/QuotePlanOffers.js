"use client";

// app/components/quotes/QuotePlanOffers.js
//
// "Add a maintenance plan" — the staff side of a recurring plan on a quote.
// Rendered in the quote builder (under the extras) and on the quote page.
//
// Two ways to put a plan on a quote, the owner's "as an add-on and manual":
//
//   included  staff decide it is part of the deal; approving the quote starts it
//   optional  offered beside the extras; the client ticks it on their page
//
// Every figure shown is the SERVER's (offerPricing over the frozen offer, or
// over the template for the preview) except the live preview while choosing,
// which runs the same offerPricing in the browser — the arithmetic the plan's
// invoices will use, never a second copy of it. Nothing priced is posted: the
// server freezes the template's own price and discount onto the quote.
//
// A member without showPricing gets a 403 from the route and this panel
// renders nothing — a plan with its prices stripped is not a useful panel.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Repeat, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { moneyFormatter } from "@/lib/format/money";
import { offerPricing, textIn } from "@/lib/servicePlans/templates";

export default function QuotePlanOffers({ quoteId }) {
  const { t, language } = useTranslation();
  const { currency } = useCompanyPreferences();
  const money = moneyFormatter(currency, language);

  const [data, setData] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | hidden | error
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ templateId: "", mode: "optional", startDate: "", taxRatePct: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetchJson(`/api/quotes/${quoteId}/plan-offers`);
      setData(res);
      setState("ready");
    } catch (err) {
      // No pricing permission: say nothing rather than a broken panel.
      if (err?.status === 403) setState("hidden");
      else {
        setError(err?.message || t("app.planOffers.loadError"));
        setState("error");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  useEffect(() => {
    if (quoteId) load();
  }, [quoteId, load]);

  const template = useMemo(
    () => (data?.templates || []).find((x) => x.id === form.templateId) || null,
    [data, form.templateId],
  );

  const preview = useMemo(() => {
    if (!template || template.pricePerVisit === null) return null;
    return offerPricing({
      ...template,
      taxRatePct: form.taxRatePct === "" ? null : Number(form.taxRatePct),
    });
  }, [template, form.taxRatePct]);

  if (!quoteId || state === "hidden") return null;

  const openAdd = () => {
    setError("");
    setForm({
      templateId: "",
      mode: "optional",
      startDate: "",
      taxRatePct: data?.defaultTaxRatePct === null || data?.defaultTaxRatePct === undefined ? "" : String(data.defaultTaxRatePct),
    });
    setAdding(true);
  };

  const add = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await fetchJson(`/api/quotes/${quoteId}/plan-offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {
          templateId: form.templateId,
          mode: form.mode,
          startDate: form.startDate || null,
          taxRatePct: form.taxRatePct === "" ? null : form.taxRatePct,
        },
      });
      setAdding(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (offerId) => {
    setError("");
    try {
      await fetchJson(`/api/quotes/${quoteId}/plan-offers?offerId=${encodeURIComponent(offerId)}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const visitsLabel = (n) => (n === 1 ? t("app.planOffers.visitOne") : t("app.planOffers.visits", { count: n }));
  const cadence = (o) =>
    [
      t(`app.plans.freq.${o.frequency}`),
      o.visitCount ? visitsLabel(o.visitCount) : t("app.planOffers.untilCancelled"),
    ].join(" · ");

  const figures = (o, p) => (
    <>
      <p className="text-sm text-foreground">
        {p.perVisit.discountCents > 0 && (
          <span className="line-through text-muted-foreground mr-1.5">{money(p.perVisit.gross)}</span>
        )}
        <span className="font-semibold">{t("app.planOffers.perVisit", { amount: money(p.perVisit.subtotal) })}</span>
        {o.discountPct > 0 && (
          <span className="ml-2 text-xs font-medium text-green-700 dark:text-green-400">
            {t("app.planOffers.discount", { pct: o.discountPct })}
          </span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">{cadence(o)}</p>
      {p.yearly !== null && p.monthly !== null ? (
        <p className="text-xs text-muted-foreground">
          {t("app.planOffers.worksOut", { monthly: money(p.monthly), yearly: money(p.yearly) })}
        </p>
      ) : p.term ? (
        <p className="text-xs text-muted-foreground">
          {t("app.planOffers.term", { visits: visitsLabel(p.term.occurrences), amount: money(p.term.subtotal) })}
        </p>
      ) : null}
      {o.taxRatePct !== null && o.taxRatePct !== undefined && Number(o.taxRatePct) > 0 && (
        <p className="text-xs text-muted-foreground">{t("app.planOffers.plusTax", { pct: o.taxRatePct })}</p>
      )}
    </>
  );

  const offers = data?.offers || [];
  const templates = data?.templates || [];
  const locked = Boolean(data?.locked);
  const accepted = data?.status === "accepted";

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3" data-quote-plan-offers>
      <div className="flex items-start gap-2">
        <Repeat size={16} className="mt-0.5 text-muted-foreground shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("app.planOffers.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("app.planOffers.intro")}</p>
        </div>
      </div>

      {state === "loading" && (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> {t("app.common.loading", "Loading…")}
        </p>
      )}
      {state === "error" && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {state === "ready" && (
        <>
          {offers.map((o) => {
            const taken = o.mode === "included" || o.selected;
            return (
              <div key={o.id} className="rounded-lg border border-border px-3 py-2.5 space-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {o.name}
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {t(`app.planOffers.badge.${o.mode}`)}
                    </span>
                  </p>
                  {!locked && !o.servicePlanId && (
                    <button
                      type="button"
                      onClick={() => remove(o.id)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground min-h-[32px]"
                    >
                      <X size={12} /> {t("app.planOffers.remove")}
                    </button>
                  )}
                </div>
                {figures(o, o.pricing)}
                <p className="text-xs text-muted-foreground">
                  {o.startDate
                    ? t("app.planOffers.firstVisit", { date: String(o.startDate).slice(0, 10) })
                    : t("app.planOffers.firstVisitAfter")}
                </p>
                <p className="text-xs text-muted-foreground italic">{t("app.planOffers.notInTotal")}</p>
                {o.servicePlanId ? (
                  <Link href={`/app/plans/${o.servicePlanId}`} className="inline-block text-xs font-medium underline text-foreground mt-1">
                    {t("app.planOffers.created")}
                  </Link>
                ) : accepted && taken ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{t("app.planOffers.notCreated")}</p>
                ) : locked && !taken ? (
                  <p className="text-xs text-muted-foreground mt-1">{t("app.planOffers.notChosen")}</p>
                ) : o.mode === "optional" && o.selected ? (
                  <p className="text-xs text-foreground mt-1">{t("app.planOffers.clientChose")}</p>
                ) : null}
              </div>
            );
          })}

          {!locked && !adding && templates.length > 0 && offers.length < (data?.max || 4) && (
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Plus size={14} /> {t("app.planOffers.add")}
            </button>
          )}
          {!locked && offers.length >= (data?.max || 4) && (
            <p className="text-xs text-muted-foreground">{t("app.planOffers.max")}</p>
          )}
          {!locked && templates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t("app.planOffers.none")}{" "}
              <Link href="/app/settings/maintenance-plans" className="underline text-foreground">
                {t("app.planOffers.setUp")}
              </Link>
            </p>
          )}

          {adding && (
            <form onSubmit={add} className="rounded-lg border border-border p-3 space-y-3">
              <div>
                <label htmlFor="plan-offer-template" className="block text-xs font-medium text-foreground mb-1">
                  {t("app.planOffers.pick")}
                </label>
                <select
                  id="plan-offer-template"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={form.templateId}
                  onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}
                >
                  <option value="">{t("app.planOffers.pickPlaceholder")}</option>
                  {templates.map((tpl) => {
                    const name = textIn(tpl.name, data?.language, data?.companyLanguage);
                    const unpriced = tpl.pricePerVisit === null;
                    const already = offers.some((o) => o.templateId === tpl.id);
                    return (
                      <option key={tpl.id} value={tpl.id} disabled={unpriced || already}>
                        {name}
                        {unpriced ? ` — ${t("app.planOffers.noPrice")}` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <fieldset>
                <legend className="block text-xs font-medium text-foreground mb-1">{t("app.planOffers.modeLabel")}</legend>
                {["optional", "included"].map((mode) => (
                  <label key={mode} className="flex items-start gap-2 text-sm text-foreground py-0.5 cursor-pointer">
                    <input
                      type="radio"
                      name="plan-offer-mode"
                      className="mt-1"
                      checked={form.mode === mode}
                      onChange={() => setForm((f) => ({ ...f, mode }))}
                    />
                    <span>{t(`app.planOffers.mode.${mode}`)}</span>
                  </label>
                ))}
              </fieldset>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="plan-offer-start" className="block text-xs font-medium text-foreground mb-1">
                    {t("app.planOffers.startDate")}
                  </label>
                  <input
                    id="plan-offer-start"
                    type="date"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">{t("app.planOffers.startHelp")}</p>
                </div>
                <div>
                  <label htmlFor="plan-offer-tax" className="block text-xs font-medium text-foreground mb-1">
                    {t("app.planOffers.tax")}
                  </label>
                  <input
                    id="plan-offer-tax"
                    type="number"
                    min="0"
                    max="100"
                    step="0.001"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    value={form.taxRatePct}
                    placeholder={t("app.plans.taxNone")}
                    onChange={(e) => setForm((f) => ({ ...f, taxRatePct: e.target.value }))}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">{t("app.planOffers.taxHelp")}</p>
                </div>
              </div>

              {template && preview && (
                <div className="rounded-lg bg-muted px-3 py-2 space-y-0.5">
                  {figures({ ...template, taxRatePct: form.taxRatePct === "" ? null : Number(form.taxRatePct) }, preview)}
                </div>
              )}

              {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving || !form.templateId}
                  className="bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? t("app.planOffers.saving") : t("app.planOffers.save")}
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="px-4 py-2 rounded-full text-sm text-muted-foreground border border-border"
                >
                  {t("app.planOffers.cancel")}
                </button>
              </div>
            </form>
          )}
          {!adding && error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </>
      )}
    </div>
  );
}
