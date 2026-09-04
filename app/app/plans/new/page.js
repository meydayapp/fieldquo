"use client";

// app/app/plans/new/page.js
//
// Sell a service plan: which client, which service, what it costs, how often,
// and for how long.
//
// ── The live total is computed by the SAME code the invoices will use ────────
//
// occurrenceAmounts and termTotals are imported here rather than re-implemented
// as a bit of JSX arithmetic. The figure the contractor quotes is therefore the
// figure that gets billed, to the cent, including how the discount rounds. A
// second implementation on the screen is how a plan comes to promise $450.00
// and invoice $450.01.
//
// ── Payment terms are set once and cannot be edited ─────────────────────────
//
// Said on this form, not discovered later: the client's authorisation names
// these exact figures, so changing them afterwards would be a charge nobody
// agreed to. The API refuses it too (PATCH accepts only the name).

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { moneyFormatter } from "@/lib/format/money";
import { fetchArray } from "@/lib/loadState";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { PLAN_FREQUENCY_KEYS, plannedOccurrenceCount } from "@/lib/servicePlans/schedule";
import { occurrenceAmounts, termTotals } from "@/lib/servicePlans/pricing";

const TODAY = () => new Date().toISOString().slice(0, 10);

export default function NewServicePlanPage() {
  const { t, language } = useTranslation();
  const router = useRouter();

  // null until each server answers. `[]` is a claim — "this company has no
  // clients" — and an empty <select> with no explanation is how somebody
  // concludes their client book has gone. See lib/loadState.js.
  const [clients, setClients] = useState(null);
  const [services, setServices] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    clientId: "",
    name: "",
    serviceName: "",
    categoryId: "",
    frequency: "semiannual",
    startDate: TODAY(),
    endMode: "count",
    occurrenceCount: 2,
    endDate: "",
    amountPerOccurrence: "",
    discountPct: "",
    taxRatePct: "",
    collectionMode: "invoice",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    // Both lists gate the form: no client and no service means no plan can be
    // sold. A failure that leaves two empty dropdowns and says nothing reads
    // as "this company has nothing set up", which is the wrong story to tell
    // somebody whose settings call was simply refused.
    (async () => {
      const result = await fetchArray("/api/clients");
      if (result.aborted) return;
      if (result.ok) setClients(result.data);
      else setError(t(result.errorKey));
    })();
    (async () => {
      const result = await fetchArray("/api/settings/service-categories");
      if (result.aborted) return;
      if (result.ok) setServices(result.data.filter((s) => s.enabled));
      else setError(t(result.errorKey));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The company's billing currency, from the provider the layout already
  // seeded — not a private business-info fetch whose swallowed failure left
  // this preview quoting a euro plan in dollars.
  const { currency } = useCompanyPreferences();
  const money = moneyFormatter(currency, language);

  // The preview, from the production arithmetic. `planShape` mirrors exactly
  // what the API will store, so what is shown here is what will be billed.
  const preview = useMemo(() => {
    const planShape = {
      amountPerOccurrence: Number(form.amountPerOccurrence) || 0,
      discountPct: Number(form.discountPct) || 0,
      taxRatePct: form.taxRatePct === "" ? null : Number(form.taxRatePct),
      frequency: form.frequency,
      startDate: form.startDate ? new Date(`${form.startDate}T00:00:00.000Z`) : null,
      endMode: form.endMode,
      occurrenceCount: Number(form.occurrenceCount) || null,
      endDate: form.endDate ? new Date(`${form.endDate}T00:00:00.000Z`) : null,
    };
    const amounts = occurrenceAmounts(planShape);
    const planned = planShape.startDate ? plannedOccurrenceCount(planShape) : null;
    return { amounts, planned, term: termTotals(planShape, planned) };
  }, [form]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const plan = await fetchJson("/api/service-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      router.push(`/app/plans/${plan.id}`);
    } catch (err) {
      // Never a bare `if (res.ok)` with no else — fetchJson surfaces the API's
      // own sentence, which is what validatePlanInput was written to produce.
      setError(err.message);
      setSaving(false);
    }
  };

  const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
  const label = "block text-sm font-medium text-foreground mb-1";

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <Link
        href="/app/plans"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} /> {t("app.plans.back")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.plans.newTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.plans.newSubtitle")}</p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div>
            <label className={label} htmlFor="plan-client">{t("app.plans.client")}</label>
            <select
              id="plan-client"
              className={field}
              value={form.clientId}
              onChange={(e) => set("clientId", e.target.value)}
            >
              <option value="">{t("app.plans.pickClient")}</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={label} htmlFor="plan-service">{t("app.plans.service")}</label>
            <select
              id="plan-service"
              className={field}
              value={form.categoryId}
              onChange={(e) => {
                const picked = (services ?? []).find((s) => s.id === e.target.value);
                set("categoryId", e.target.value);
                // The NAME is copied, not looked up later — a company renaming a
                // trade must not rewrite what a client agreed to buy.
                set("serviceName", picked?.label || "");
              }}
            >
              <option value="">{t("app.plans.pickService")}</option>
              {(services ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={label} htmlFor="plan-name">{t("app.plans.name")}</label>
            <input
              id="plan-name"
              className={field}
              value={form.name}
              placeholder={t("app.plans.namePlaceholder")}
              onChange={(e) => set("name", e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">{t("app.plans.nameHelp")}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">{t("app.plans.scheduleTitle")}</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="plan-freq">{t("app.plans.frequency")}</label>
              <select
                id="plan-freq"
                className={field}
                value={form.frequency}
                onChange={(e) => set("frequency", e.target.value)}
              >
                {PLAN_FREQUENCY_KEYS.map((f) => (
                  <option key={f} value={f}>{t(`app.plans.freq.${f}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="plan-start">{t("app.plans.startDate")}</label>
              <input
                id="plan-start"
                type="date"
                className={field}
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </div>
          </div>

          <div>
            <span className={label}>{t("app.plans.length")}</span>
            <div className="flex gap-2 flex-wrap">
              {["count", "until", "open"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set("endMode", mode)}
                  className={`rounded-full px-3 py-1.5 text-sm border ${
                    form.endMode === mode
                      ? "bg-inverted text-inverted-foreground border-inverted"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {t(`app.plans.end.${mode}`)}
                </button>
              ))}
            </div>
          </div>

          {form.endMode === "count" && (
            <div>
              <label className={label} htmlFor="plan-count">{t("app.plans.visitCount")}</label>
              <input
                id="plan-count"
                type="number"
                min="1"
                className={field}
                value={form.occurrenceCount}
                onChange={(e) => set("occurrenceCount", e.target.value)}
              />
            </div>
          )}
          {form.endMode === "until" && (
            <div>
              <label className={label} htmlFor="plan-end">{t("app.plans.endDate")}</label>
              <input
                id="plan-end"
                type="date"
                className={field}
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </div>
          )}
          {form.endMode === "open" && (
            <p className="text-sm text-muted-foreground">{t("app.plans.openHelp")}</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">{t("app.plans.moneyTitle")}</h2>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={label} htmlFor="plan-amount">{t("app.plans.amount")}</label>
              <input
                id="plan-amount"
                type="number"
                min="0"
                step="0.01"
                className={field}
                value={form.amountPerOccurrence}
                onChange={(e) => set("amountPerOccurrence", e.target.value)}
              />
            </div>
            <div>
              <label className={label} htmlFor="plan-discount">{t("app.plans.discount")}</label>
              <input
                id="plan-discount"
                type="number"
                min="0"
                max="99"
                step="0.1"
                className={field}
                value={form.discountPct}
                onChange={(e) => set("discountPct", e.target.value)}
              />
            </div>
            <div>
              <label className={label} htmlFor="plan-tax">{t("app.plans.tax")}</label>
              <input
                id="plan-tax"
                type="number"
                min="0"
                max="100"
                step="0.001"
                className={field}
                value={form.taxRatePct}
                placeholder={t("app.plans.taxNone")}
                onChange={(e) => set("taxRatePct", e.target.value)}
              />
              {/* Blank means "no tax on this plan", not "we'll work it out". */}
              <p className="text-xs text-muted-foreground mt-1">{t("app.plans.taxHelp")}</p>
            </div>
          </div>

          <div className="rounded-lg bg-accent p-3 text-sm">
            <p className="text-foreground">
              {t("app.plans.previewPer", { amount: money(preview.amounts.total) })}
            </p>
            {preview.term ? (
              <p className="text-muted-foreground mt-0.5">
                {t("app.plans.previewTerm", {
                  count: preview.term.occurrences,
                  amount: money(preview.term.total),
                  saved: money(preview.term.discount),
                })}
              </p>
            ) : (
              <p className="text-muted-foreground mt-0.5">{t("app.plans.previewOpen")}</p>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">{t("app.plans.collectionTitle")}</h2>
          {["invoice", "automatic"].map((mode) => (
            <label key={mode} className="flex gap-3 items-start cursor-pointer">
              <input
                type="radio"
                name="collectionMode"
                className="mt-1"
                checked={form.collectionMode === mode}
                onChange={() => set("collectionMode", mode)}
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  {t(`app.plans.collect.${mode}.title`)}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {t(`app.plans.collect.${mode}.body`)}
                </span>
              </span>
            </label>
          ))}
        </div>

        <p className="flex gap-2 text-sm text-muted-foreground">
          <Info size={16} className="shrink-0 mt-0.5" />
          {t("app.plans.frozenNotice")}
        </p>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50"
        >
          {saving ? t("app.plans.saving") : t("app.plans.create")}
        </button>
      </form>
    </div>
  );
}
