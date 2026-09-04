// app/app/settings/team/payroll/page.js
"use client";

import { useState, useEffect } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { reportResponseError } from "@/lib/clientErrors";
import {
  payoutStatusClasses,
  payoutStatusLabel,
} from "@/lib/payroll/payoutStatusPresentation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";

function PayrollPageScreen() {
  const money = useCompanyMoney();
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  // null = never loaded. Distinct from [] — see the render below. A toast on a
  // failed GET was an improvement on silence, but it disappears, and what it
  // left behind was still the sentence "No payouts yet" on a screen about
  // whether people have been paid.
  const [payouts, setPayouts] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [range, setRange] = useState({ periodStart: "", periodEnd: "" });

  async function load() {
    // Array-guarded on the way in. A 200 that isn't a list (a route returning
    // { error } with the wrong status, a shape change) would otherwise reach
    // `payouts.map` and blank the screen.
    const data = await fetchJson("/api/payouts");
    return Array.isArray(data) ? data : [];
  }

  useEffect(() => {
    load()
      .then((rows) => {
        setPayouts(rows);
        setLoadError("");
      })
      .catch((err) =>
        setLoadError(
          err.message || t("app.payrollRun.loadFailed", "Couldn't load payouts."),
        ),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runPayouts(e) {
    e.preventDefault();
    setRunning(true);
    const res = await fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(range),
    });
    setRunning(false);
    if (res.ok) {
      // The run SUCCEEDED; only the re-read failed. Saying "couldn't load"
      // without saying that would read as the pay run having failed, which is
      // the more expensive wrong conclusion — somebody runs it twice.
      try {
        setPayouts(await load());
        setLoadError("");
      } catch (err) {
        setLoadError(
          err.message ||
            t("app.payrollRun.loadFailed", "Couldn't load payouts."),
        );
      }
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.payroll.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.payrollRun.subtitle")}
        </p>
      </div>

      <form
        onSubmit={runPayouts}
        className="bg-card border border-border rounded-xl p-4 flex gap-2 items-end"
      >
        <div>
          <label className="text-xs text-muted-foreground">
            {t("app.payroll.periodStart")}
          </label>
          <input
            type="date"
            required
            value={range.periodStart}
            onChange={(e) =>
              setRange({ ...range, periodStart: e.target.value })
            }
            className="border rounded px-3 py-2 text-sm block"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">
            {t("app.payroll.periodEnd")}
          </label>
          <input
            type="date"
            required
            value={range.periodEnd}
            onChange={(e) => setRange({ ...range, periodEnd: e.target.value })}
            className="border rounded px-3 py-2 text-sm block"
          />
        </div>
        <button
          type="submit"
          disabled={running}
          className="bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {running ? t("app.payrollRun.running") : t("app.payrollRun.runPayouts")}
        </button>
      </form>

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {/* Three states, three sentences. "No payouts yet" fired on a failed
            request too, which is a claim about the business made out of a
            network error — and on this screen the claim is "nobody has been
            paid". */}
        {loadError ? (
          <p className="px-5 py-6 text-sm text-red-700 dark:text-red-300">
            {loadError}
          </p>
        ) : (
          payouts?.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              {t("app.payrollRun.noPayouts")}
            </p>
          )
        )}
        {(payouts || []).map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between px-5 py-3"
          >
            <div>
              <div className="text-sm font-medium text-foreground">
                {p.worker?.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(p.periodStart)} –{" "}
                {formatDate(p.periodEnd)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">
                {money(p.amount)}
              </div>
              {/* Was `capitalize text-muted-foreground` for all four values, so
                  a FAILED transfer and a PAID one were the same grey line with
                  one word different. The money didn't move and the screen said
                  so in the quietest style it had. */}
              <div
                className={`mt-0.5 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${payoutStatusClasses(
                  p.status,
                )}`}
              >
                {payoutStatusLabel(p.status, t)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hidden, not read-only ──────────────────────────────────────────────────
//
// "Run contractor payouts for approved hours", with period inputs and a live
// Run Payouts submit button. The ENDPOINT behind it has always refused
// non-payroll-admins — POST /api/payroll/runs answers "You don't have
// permission to run payroll" — but QA declined to press it across three
// passes, and an unpressed button is an unanswered question. Removing the
// screen removes the question.
export default function PayrollPage() {
  const access = useSettingsAccess();
  if (!access.canSee("payroll")) return <NoAccessPanel capability="payroll" />;
  return <PayrollPageScreen />;
}
