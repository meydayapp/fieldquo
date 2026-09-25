"use client";

// app/app/settings/maintenance-plans/page.js
//
// Settings → Maintenance plans. The recurring plans a company sells again and
// again — "Quarterly Deep Clean, 4 visits, 10% off every visit" — kept once
// and put on any quote from the quote builder (app/components/quotes/
// QuotePlanOffers.js), included in the deal or as an option the client ticks.
//
// ── Priced per visit, and the screen says why ───────────────────────────────
//
// A plan here is a per-visit price and a discount off every visit, because
// that is what the plan engine bills (lib/servicePlans/run.js): one invoice per
// visit. The monthly and yearly figures are computed from those two numbers
// by the same arithmetic the invoices use (offerPricing) and are labelled as
// what the visits "work out to" — never a second, separate fee.
//
// ── Retire, never delete ───────────────────────────────────────────────────
//
// Quotes that offered a plan and plans that were sold from one point back
// here. Retiring stops it being offered; editing changes the NEXT quote only,
// because a quote freezes its own copy of the terms.
//
// ── Languages ──────────────────────────────────────────────────────────────
//
// The name and "what's included" are written per document language, because a
// quote in French offers its plan in French and nothing is machine-translated
// onto a client document. The company's own language is the first field; the
// others sit under a disclosure and a blank one prints the company's wording.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Repeat, RotateCcw, Sparkles } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { moneyFormatter } from "@/lib/format/money";
import { LANGUAGES } from "@/app/i18n/languages";
import {
  PLAN_FREQUENCY_KEYS,
  PLAN_TEMPLATE_LANGUAGES,
  offerPricing,
  textIn,
} from "@/lib/servicePlans/templates";

const EMPTY = {
  name: {},
  description: {},
  frequency: "quarterly",
  visitCount: "4",
  pricePerVisit: "",
  discountPct: "",
  includedProductIds: [],
};

const langName = (code) => LANGUAGES.find((l) => l.code === code)?.nativeName || code.toUpperCase();

export default function MaintenancePlansSettingsPage() {
  const { t, language } = useTranslation();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | template id
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/settings/plan-templates"));
      setFailed("");
    } catch (err) {
      setFailed(err?.message || t("app.planTemplates.loadError"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const money = moneyFormatter(data?.currency, language);
  const companyLanguage = data?.companyLanguage || "en";
  const otherLanguages = PLAN_TEMPLATE_LANGUAGES.filter((l) => l !== companyLanguage);

  const preview = useMemo(() => {
    const price = Number(form.pricePerVisit);
    if (!(price > 0)) return null;
    return offerPricing({
      pricePerVisit: price,
      discountPct: Number(form.discountPct) || 0,
      taxRatePct: null,
      frequency: form.frequency,
      visitCount: form.visitCount === "" ? null : Number(form.visitCount),
    });
  }, [form]);

  const startNew = () => {
    setForm(EMPTY);
    setEditing("new");
    setError("");
  };

  const startEdit = (tpl) => {
    setForm({
      name: { ...(tpl.name || {}) },
      description: { ...(tpl.description || {}) },
      frequency: tpl.frequency,
      visitCount: tpl.visitCount === null ? "" : String(tpl.visitCount),
      pricePerVisit: tpl.pricePerVisit === null ? "" : String(tpl.pricePerVisit),
      discountPct: tpl.discountPct ? String(tpl.discountPct) : "",
      includedProductIds: [...(tpl.includedProductIds || [])],
    });
    setEditing(tpl.id);
    setError("");
  };

  const setLang = (field, lang, value) =>
    setForm((f) => ({ ...f, [field]: { ...f[field], [lang]: value } }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      ...form,
      visitCount: form.visitCount === "" ? null : form.visitCount,
      pricePerVisit: form.pricePerVisit === "" ? null : form.pricePerVisit,
    };
    try {
      if (editing === "new") {
        await fetchJson("/api/settings/plan-templates", { method: "POST", body });
      } else {
        await fetchJson(`/api/settings/plan-templates/${editing}`, { method: "PATCH", body });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (tpl, active) => {
    setNotice("");
    try {
      await fetchJson(`/api/settings/plan-templates/${tpl.id}`, { method: "PATCH", body: { active } });
      await load();
    } catch (err) {
      setNotice(err.message);
    }
  };

  const seed = async () => {
    setSeeding(true);
    setNotice("");
    try {
      const r = await fetchJson("/api/settings/plan-templates", { method: "POST", body: { action: "seed" } });
      setNotice(
        [
          t("app.planTemplates.starterAdded", { count: r.created }),
          r.unpriced > 0 ? t("app.planTemplates.starterUnpriced", { count: r.unpriced }) : "",
        ].filter(Boolean).join(" "),
      );
      await load();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSeeding(false);
    }
  };

  const templates = data?.templates || [];
  const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
  const label = "block text-sm font-medium text-foreground mb-1";

  const visitsLabel = (n) => (n === 1 ? t("app.planOffers.visitOne") : t("app.planOffers.visits", { count: n }));

  const summary = (tpl) => {
    const cadence = [
      t(`app.plans.freq.${tpl.frequency}`),
      tpl.visitCount ? visitsLabel(tpl.visitCount) : t("app.planOffers.untilCancelled"),
    ].join(" · ");
    if (tpl.pricePerVisit === null) return { cadence, price: null };
    const p = offerPricing({ ...tpl, taxRatePct: null });
    return { cadence, price: p };
  };

  const editor = (
    <form onSubmit={save} className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div>
        <label className={label} htmlFor="tpl-name">
          {t("app.planTemplates.nameIn", { lang: langName(companyLanguage) })}
        </label>
        <input
          id="tpl-name"
          className={field}
          value={form.name[companyLanguage] || ""}
          onChange={(e) => setLang("name", companyLanguage, e.target.value)}
        />
      </div>
      <div>
        <label className={label} htmlFor="tpl-desc">{t("app.planTemplates.description")}</label>
        <textarea
          id="tpl-desc"
          rows={3}
          className={field}
          value={form.description[companyLanguage] || ""}
          onChange={(e) => setLang("description", companyLanguage, e.target.value)}
        />
      </div>

      <details className="rounded-lg border border-border px-3 py-2">
        <summary className="text-sm font-medium text-foreground cursor-pointer">
          {t("app.planTemplates.otherLanguages")}
        </summary>
        <p className="text-xs text-muted-foreground mt-1 mb-2">{t("app.planTemplates.otherLanguagesHelp")}</p>
        <div className="space-y-3">
          {otherLanguages.map((lang) => (
            <div key={lang} className="grid sm:grid-cols-2 gap-2">
              <input
                aria-label={t("app.planTemplates.nameIn", { lang: langName(lang) })}
                placeholder={t("app.planTemplates.nameIn", { lang: langName(lang) })}
                className={field}
                value={form.name[lang] || ""}
                onChange={(e) => setLang("name", lang, e.target.value)}
              />
              <textarea
                aria-label={`${t("app.planTemplates.description")} (${langName(lang)})`}
                placeholder={`${t("app.planTemplates.description")} (${langName(lang)})`}
                rows={2}
                className={field}
                value={form.description[lang] || ""}
                onChange={(e) => setLang("description", lang, e.target.value)}
              />
            </div>
          ))}
        </div>
      </details>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="tpl-freq">{t("app.planTemplates.frequency")}</label>
          <select
            id="tpl-freq"
            className={field}
            value={form.frequency}
            onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
          >
            {PLAN_FREQUENCY_KEYS.map((k) => (
              <option key={k} value={k}>{t(`app.plans.freq.${k}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="tpl-count">{t("app.planTemplates.visitCount")}</label>
          <input
            id="tpl-count"
            type="number"
            min="1"
            max="520"
            className={field}
            value={form.visitCount}
            placeholder={t("app.planOffers.untilCancelled")}
            onChange={(e) => setForm((f) => ({ ...f, visitCount: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground mt-1">{t("app.planTemplates.visitCountHelp")}</p>
        </div>
        <div>
          <label className={label} htmlFor="tpl-price">{t("app.planTemplates.price")}</label>
          <input
            id="tpl-price"
            type="number"
            min="0"
            step="0.01"
            className={field}
            value={form.pricePerVisit}
            onChange={(e) => setForm((f) => ({ ...f, pricePerVisit: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground mt-1">{t("app.planTemplates.priceHelp")}</p>
        </div>
        <div>
          <label className={label} htmlFor="tpl-discount">{t("app.planTemplates.discount")}</label>
          <input
            id="tpl-discount"
            type="number"
            min="0"
            max="99"
            step="0.1"
            className={field}
            value={form.discountPct}
            onChange={(e) => setForm((f) => ({ ...f, discountPct: e.target.value }))}
          />
        </div>
      </div>

      {(data?.products || []).length > 0 && (
        <div>
          <span className={label}>{t("app.planTemplates.includes")}</span>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
            {data.products.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.includedProductIds.includes(p.id)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      includedProductIds: e.target.checked
                        ? [...f.includedProductIds, p.id]
                        : f.includedProductIds.filter((x) => x !== p.id),
                    }))
                  }
                />
                {p.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <div className="rounded-lg bg-accent p-3 text-sm space-y-0.5">
          <p className="text-foreground font-medium">
            {t("app.planOffers.perVisit", { amount: money(preview.perVisit.subtotal) })}
            {Number(form.discountPct) > 0 && (
              <span className="ml-2 text-xs text-green-700 dark:text-green-400">
                {t("app.planOffers.discount", { pct: Number(form.discountPct) })}
              </span>
            )}
          </p>
          {preview.yearly !== null && preview.monthly !== null ? (
            <p className="text-muted-foreground text-xs">
              {t("app.planOffers.worksOut", { monthly: money(preview.monthly), yearly: money(preview.yearly) })}
            </p>
          ) : preview.term ? (
            <p className="text-muted-foreground text-xs">
              {t("app.planOffers.term", { visits: visitsLabel(preview.term.occurrences), amount: money(preview.term.subtotal) })}
            </p>
          ) : null}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-inverted text-inverted-foreground px-5 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
        >
          {saving ? t("app.planTemplates.saving") : t("app.planTemplates.save")}
        </button>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="px-5 py-2 rounded-full text-sm text-muted-foreground border border-border"
        >
          {t("app.planTemplates.cancel")}
        </button>
      </div>
    </form>
  );

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Repeat size={22} /> {t("app.planTemplates.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.planTemplates.subtitle")}</p>
        <p className="text-xs text-muted-foreground mt-2">{t("app.planTemplates.howBilled")}</p>
      </div>

      {failed ? (
        <p role="alert" className="text-sm text-muted-foreground">{failed}</p>
      ) : data === null ? (
        <div className="h-16 bg-accent rounded-lg animate-pulse" />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {editing === null && (
              <button
                type="button"
                onClick={startNew}
                className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold"
              >
                <Plus size={14} /> {t("app.planTemplates.new")}
              </button>
            )}
            {data.starterMissing > 0 && (
              <button
                type="button"
                onClick={seed}
                disabled={seeding}
                className="inline-flex items-center gap-1.5 border border-border px-4 py-2 rounded-full text-sm font-medium text-foreground disabled:opacity-50"
              >
                {seeding ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {t("app.planTemplates.addStarter", { count: data.starterMissing })}
              </button>
            )}
          </div>
          {notice && <p className="text-sm text-foreground">{notice}</p>}

          {editing === "new" && editor}

          {templates.length === 0 && editing !== "new" ? (
            <p className="text-sm text-muted-foreground">{t("app.planTemplates.empty")}</p>
          ) : (
            <ul className="space-y-2">
              {templates.map((tpl) => {
                if (editing === tpl.id) return <li key={tpl.id}>{editor}</li>;
                const s = summary(tpl);
                const langs = PLAN_TEMPLATE_LANGUAGES.filter((l) => tpl.name?.[l]).length;
                return (
                  <li
                    key={tpl.id}
                    className={`rounded-xl border border-border bg-card px-4 py-3 ${tpl.active ? "" : "opacity-70"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {textIn(tpl.name, language, companyLanguage)}
                          {tpl.seedKey && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {t("app.planTemplates.starter")}
                            </span>
                          )}
                          {!tpl.active && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {t("app.planTemplates.retired")}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.cadence}</p>
                        {s.price ? (
                          <p className="text-xs text-foreground mt-0.5">
                            {t("app.planOffers.perVisit", { amount: money(s.price.perVisit.subtotal) })}
                            {tpl.discountPct > 0 && ` · ${t("app.planOffers.discount", { pct: tpl.discountPct })}`}
                            {s.price.yearly !== null && s.price.monthly !== null
                              ? ` · ${t("app.planOffers.worksOut", { monthly: money(s.price.monthly), yearly: money(s.price.yearly) })}`
                              : s.price.term
                                ? ` · ${t("app.planOffers.term", { visits: visitsLabel(s.price.term.occurrences), amount: money(s.price.term.subtotal) })}`
                                : ""}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{t("app.planTemplates.unpriced")}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {t("app.planTemplates.languages", { count: langs })}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {editing === null && (
                          <button
                            type="button"
                            onClick={() => startEdit(tpl)}
                            className="text-xs font-medium text-foreground underline min-h-[32px]"
                          >
                            {t("app.planTemplates.edit")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActive(tpl, !tpl.active)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground min-h-[32px]"
                        >
                          {tpl.active ? t("app.planTemplates.retire") : (<><RotateCcw size={12} /> {t("app.planTemplates.restore")}</>)}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
