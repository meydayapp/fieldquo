// app/app/settings/commissions/page.js
//
// Settings › Commissions — whether the company pays commission on its own
// jobs, on what basis, and each person's rates.
//
// ── What the page has to say out loud ──────────────────────────────────────
//
// Commission is EARNED on money collected, not on an invoice sent; it is
// never added to anyone's pay on its own — the pay-run screen offers it as a
// line the owner ticks; and switching it on does not reach back to payments
// taken before. Each of those is a place a reader would otherwise assume the
// opposite, so each is a sentence here rather than a footnote somewhere else.
"use client";

import { useState } from "react";
import Link from "next/link";
import { Percent, Loader2, Info } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { useCommissionSettings } from "@/app/components/commissions/useCommissionSettings";
import CommissionRates from "@/app/components/commissions/CommissionRates";
import { formatCalendarDay } from "@/lib/format/localeDate";

export default function CommissionSettingsPage() {
  const access = useSettingsAccess();
  if (!access.canSee("payroll")) return <NoAccessPanel capability="payroll" />;
  return <CommissionSettings canChange={access.canChange("payroll")} />;
}

function CommissionSettings({ canChange }) {
  const { t, language } = useTranslation();
  const [refresh, setRefresh] = useState(0);
  const settings = useCommissionSettings(refresh);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(patch) {
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/commissions/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setRefresh((k) => k + 1);
    } catch (err) {
      setError(err.message || t("app.commissions.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  const editable = canChange && settings?.canConfigure;

  return (
    <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Percent size={20} /> {t("app.commissions.settingsTitle")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.commissions.settingsIntro")}</p>
      </div>

      {!settings ? (
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      ) : (
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.enabled}
              disabled={!editable || busy}
              onChange={(e) => save({ enabled: e.target.checked })}
            />
            <span>
              <span className="text-sm font-semibold text-foreground block">{t("app.commissions.enable")}</span>
              <span className="text-xs text-muted-foreground block">
                {settings.enabledAt
                  ? t("app.commissions.enabledSince", { date: formatCalendarDay(settings.enabledAt, language) })
                  : t("app.commissions.enableHint")}
              </span>
            </span>
          </label>

          <fieldset disabled={!editable || busy} className="space-y-2">
            <legend className="text-sm font-semibold text-foreground mb-1">{t("app.commissions.basis")}</legend>
            {[
              ["revenue", "app.commissions.basisRevenueTitle", "app.commissions.basisRevenueHint"],
              ["gross_profit", "app.commissions.basisGpTitle", "app.commissions.basisGpHint"],
            ].map(([value, title, hint]) => (
              <label key={value} className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer">
                <input
                  type="radio"
                  name="basis"
                  className="mt-1"
                  checked={settings.basis === value}
                  onChange={() => save({ basis: value })}
                />
                <span>
                  <span className="text-sm font-medium text-foreground block">{t(title)}</span>
                  <span className="text-xs text-muted-foreground block">{t(hint)}</span>
                </span>
              </label>
            ))}
            <p className="text-[11px] text-muted-foreground">{t("app.commissions.basisChangeNote")}</p>
          </fieldset>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <ul className="text-xs text-muted-foreground space-y-1.5 border-t border-border pt-3">
            {["app.commissions.rule.collected", "app.commissions.rule.payRun", "app.commissions.rule.item", "app.commissions.rule.splits"].map((k) => (
              <li key={k} className="flex items-start gap-1.5">
                <Info size={12} className="mt-0.5 shrink-0" />
                {t(k)}
              </li>
            ))}
          </ul>

          <div className="flex gap-4 flex-wrap text-sm">
            <Link href="/app/analytics/commissions" className="underline text-foreground">
              {t("app.commissions.reportLink")}
            </Link>
            <Link href="/app/settings/products" className="underline text-foreground">
              {t("app.commissions.itemRatesLink")}
            </Link>
          </div>
        </section>
      )}

      {/* The team's rates. Draws itself only while commissions are on and for
          someone who may set pay — see the component's header. */}
      <CommissionRates refreshKey={refresh} />
    </div>
  );
}
