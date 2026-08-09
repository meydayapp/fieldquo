"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

// Shown on Team + New User when the company is out of licensed seats. Posts an
// employeeCount (never a money amount — the server reprices from lib/pricing.js
// and find-or-creates the matching Plan) to the same billing checkout the
// signup flow uses, then hands off to Stripe Checkout. Kept as one component so
// the two entry points can't drift.
export default function SeatUpgradePanel({ used, limit, className = "" }) {
  const { t } = useTranslation();
  // Default to one more than the current cap — the smallest change that lets
  // them invite the next person.
  const [count, setCount] = useState(Math.max((limit || 0) + 1, 1));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpgrade() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/api/platform/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCount: Number(count) }),
      });
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return; // leaving the page — keep the button disabled through the redirect
      }
      setError(t("app.setTeam.upgradeError"));
      setLoading(false);
    } catch (err) {
      setError(err.message || t("app.setTeam.upgradeError"));
      setLoading(false);
    }
  }

  return (
    <div
      id="seat-upgrade"
      className={`bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-5 space-y-3 ${className}`}
    >
      <div>
        <p className="text-sm font-semibold text-foreground">
          {t("app.setTeam.upgradeTitle", { used, limit })}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("app.setTeam.upgradeBody")}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs font-medium text-muted-foreground mb-1">
            {t("app.setTeam.licensesLabel")}
          </span>
          <input
            type="number"
            min={Math.max((limit || 0) + 1, 1)}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-24 border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10"
          />
        </label>
        <button
          type="button"
          onClick={handleUpgrade}
          disabled={loading || !count || Number(count) < 1}
          className="bg-inverted text-inverted-foreground px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
        >
          {loading ? t("app.setTeam.upgrading") : t("app.setTeam.upgradeCta")}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("app.setTeam.upgradeTrialNote")}
      </p>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
