// app/app/settings/field-work/page.js
//
// Settings → Field work. Three switches the crew's screens run on:
//
//   1. Offline mode — whether /app keeps its field screens and their last
//      data on the phone (public/sw.js). On by default; the switch exists so
//      a company hit by a caching problem can turn it off without a deploy.
//   2. Hourly rate billed to clients — the price on the "Labour — N h × rate"
//      line the invoice editor offers from the job's clock-ins. Not a wage.
//   3. Performance pay — the daily-sheet bonus rule. NO RULE by default, and
//      the page says what that means: no bonus line anywhere until the owner
//      writes one (lib/dailySheets/bonus.js).
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, WifiOff, Clock, Award, Check } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { showToast } from "@/lib/toast";
import { showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";

export default function FieldWorkSettingsPage() {
  const access = useSettingsAccess();
  if (!access.canSee("owner-admin")) return <NoAccessPanel capability="owner-admin" />;
  return <FieldWorkScreen readOnly={!access.canChange("owner-admin")} />;
}

const EMPTY_RULE = { perObjectiveCents: 0, allDoneCents: 0, upsellPct: 0, minScore: 0 };

function FieldWorkScreen({ readOnly }) {
  const { t } = useTranslation();
  const money = useCompanyMoney();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rate, setRate] = useState("");
  const [rule, setRule] = useState(null); // null = no rule
  const [ruleDraft, setRuleDraft] = useState(EMPTY_RULE);

  const load = useCallback(async () => {
    try {
      const d = await fetchJson("/api/settings/field-work");
      setData(d);
      setRate(d.labourSellRate == null ? "" : String(d.labourSellRate));
      setRule(d.performancePayRule);
      setRuleDraft(d.performancePayRule || EMPTY_RULE);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function patch(body, okKey) {
    setBusy(true);
    try {
      const d = await fetchJson("/api/settings/field-work", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setData(d);
      setRule(d.performancePayRule);
      setRuleDraft(d.performancePayRule || EMPTY_RULE);
      setRate(d.labourSellRate == null ? "" : String(d.labourSellRate));
      if (okKey) showToast({ message: t(okKey), tone: "success" });
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <p className="text-sm rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 px-3 py-2">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 size={16} className="animate-spin" /> {t("app.state.loading")}
      </div>
    );
  }

  const dollars = (cents) => money((Number(cents) || 0) / 100);
  const ruleField = (key, value) => setRuleDraft((r) => ({ ...r, [key]: value }));

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-7 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.setField.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.setField.subtitle")}</p>
      </div>

      {/* ── 1. Offline mode ──────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <WifiOff size={16} /> {t("app.setField.offline.title")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{t("app.setField.offline.body")}</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm shrink-0">
            <input
              type="checkbox"
              checked={data.offlineCachingEnabled}
              disabled={readOnly || busy}
              onChange={(e) => patch({ offlineCachingEnabled: e.target.checked }, "app.setField.saved")}
            />
            {data.offlineCachingEnabled ? t("app.setField.on") : t("app.setField.off")}
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{t("app.setField.offline.note")}</p>
      </section>

      {/* ── 2. Hourly rate billed for clocked labour ─────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Clock size={16} /> {t("app.setField.rate.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("app.setField.rate.body")}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            min="0"
            step="0.01"
            value={rate}
            disabled={readOnly}
            onChange={(e) => setRate(e.target.value)}
            placeholder="85"
            className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <span className="text-sm text-muted-foreground">{t("app.setField.rate.perHour")}</span>
          {!readOnly && (
            <button
              type="button"
              disabled={busy}
              onClick={() => patch({ labourSellRate: rate === "" ? null : rate }, "app.setField.saved")}
              className="bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {t("app.action.save")}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {data.rateOptions.filter((r) => r.source === "category").length > 0
            ? t("app.setField.rate.alsoServices", { list: data.rateOptions.filter((r) => r.source === "category").map((r) => `${r.label} (${money(r.rate)}/h)`).join(", ") })
            : t("app.setField.rate.servicesHint")}{" "}
          <Link href="/app/settings/services" className="underline">{t("app.setField.rate.servicesLink")}</Link>
        </p>
      </section>

      {/* ── 3. Performance pay ───────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Award size={16} /> {t("app.setField.pay.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("app.setField.pay.body")}</p>
        {rule ? (
          <p className="text-sm rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-3 py-2 text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
            <Check size={14} />
            {t("app.setField.pay.ruleSummary", {
              perObjective: dollars(rule.perObjectiveCents),
              allDone: dollars(rule.allDoneCents),
              upsellPct: rule.upsellPct,
              minScore: rule.minScore || "—",
            })}
          </p>
        ) : (
          <p className="text-sm rounded-lg bg-muted px-3 py-2 text-foreground">{t("app.setField.pay.noRule")}</p>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.setField.pay.perObjective")}</span>
            <input type="number" min="0" step="0.01" disabled={readOnly} value={(ruleDraft.perObjectiveCents || 0) / 100 || ""} onChange={(e) => ruleField("perObjectiveCents", Math.round(Number(e.target.value || 0) * 100))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.setField.pay.allDone")}</span>
            <input type="number" min="0" step="0.01" disabled={readOnly} value={(ruleDraft.allDoneCents || 0) / 100 || ""} onChange={(e) => ruleField("allDoneCents", Math.round(Number(e.target.value || 0) * 100))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.setField.pay.upsellPct")}</span>
            <input type="number" min="0" max="100" step="0.5" disabled={readOnly} value={ruleDraft.upsellPct || ""} onChange={(e) => ruleField("upsellPct", Number(e.target.value || 0))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.setField.pay.minScore")}</span>
            <select disabled={readOnly} value={ruleDraft.minScore || 0} onChange={(e) => ruleField("minScore", Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value={0}>{t("app.setField.pay.noFloor")}</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{t("app.setField.pay.scoreAtLeast", { n })}</option>
              ))}
            </select>
          </label>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={busy}
              onClick={() => patch({ performancePayRule: ruleDraft }, "app.setField.saved")}
              className="bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {t("app.setField.pay.saveRule")}
            </button>
            {rule && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm(t("app.setField.pay.removeConfirm"))) patch({ performancePayRule: null }, "app.setField.saved");
                }}
                className="border border-border px-4 py-2 rounded-full text-sm font-semibold"
              >
                {t("app.setField.pay.removeRule")}
              </button>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t("app.setField.pay.note")}</p>
      </section>
    </div>
  );
}
