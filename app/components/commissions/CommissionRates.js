"use client";

// app/components/commissions/CommissionRates.js
//
// Each team member's worked-by and sold-by commission rate — the "member pay
// settings" half of the owner's Housecall Pro ask. Rendered on Team (under the
// roster) and on Settings › Commissions, one component so the two screens can
// never disagree about what a rate is or how it saves.
//
// Draws nothing unless commissions are on AND the reader may set pay
// (payroll view_all): a table of everyone's rates is pay information. A
// person's own rate is shown to them on the Commissions report instead.
//
// A blank rate is "not on commission for this role" — not 0%. The difference
// matters: only people with a rate are made earners on a job by default
// (lib/commissions/compute.js#defaultEarners), so a blank keeps an hourly
// helper from diluting the crew lead's split.

import { useEffect, useState } from "react";
import { Loader2, Percent, Check } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCommissionSettings } from "./useCommissionSettings";

const input =
  "w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm tabular-nums";

function RateRow({ row, onSaved }) {
  const { t } = useTranslation();
  const [worked, setWorked] = useState(row.workedByPct ?? "");
  const [sold, setSold] = useState(row.soldByPct ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dirty = String(worked) !== String(row.workedByPct ?? "") || String(sold) !== String(row.soldByPct ?? "");

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const next = await fetchJson("/api/commissions/rates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: row.memberId,
          workedByPct: worked === "" ? null : Number(worked),
          soldByPct: sold === "" ? null : Number(sold),
        }),
      });
      setSaved(true);
      onSaved?.(next);
    } catch (err) {
      setError(err.message || t("app.commissions.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-3 flex items-center gap-3 flex-wrap" data-commission-rate-row>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">
          {row.name || t("app.commissions.unnamed")}
        </p>
        {!row.active && <p className="text-[11px] text-muted-foreground">{t("app.commissions.inactive")}</p>}
        {error && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {t("app.commissions.workedBy")}
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={worked}
          placeholder="—"
          onChange={(e) => {
            setWorked(e.target.value);
            setSaved(false);
          }}
          className={input}
          aria-label={t("app.commissions.workedByFor", { name: row.name || "" })}
        />
        %
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {t("app.commissions.soldBy")}
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={sold}
          placeholder="—"
          onChange={(e) => {
            setSold(e.target.value);
            setSaved(false);
          }}
          className={input}
          aria-label={t("app.commissions.soldByFor", { name: row.name || "" })}
        />
        %
      </label>
      <button
        type="button"
        onClick={save}
        disabled={!dirty || busy}
        className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 min-h-[36px]"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : saved && !dirty ? <Check size={12} /> : null}
        {saved && !dirty ? t("app.commissions.saved") : t("app.action.save")}
      </button>
    </div>
  );
}

export default function CommissionRates({ compact = false, refreshKey = 0 }) {
  const { t } = useTranslation();
  const settings = useCommissionSettings(refreshKey);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  const show = Boolean(settings?.enabled && settings?.canEdit);
  useEffect(() => {
    if (!show) return undefined;
    let live = true;
    fetchJson("/api/commissions/rates")
      .then((d) => {
        if (!live) return;
        setRows(d.rates || []);
        setError("");
      })
      .catch((err) => live && setError(err.message || t("app.commissions.loadFailed")));
    return () => {
      live = false;
    };
  }, [show, reloadKey, t]);

  if (!show) return null;

  return (
    <section className="rounded-xl border border-border bg-card" data-commission-rates>
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Percent size={15} className="text-muted-foreground" />
          {t("app.commissions.ratesTitle")}
        </h2>
        {!compact && (
          <p className="text-xs text-muted-foreground mt-1">{t("app.commissions.ratesIntro")}</p>
        )}
      </div>
      {error && (
        <div className="px-4 py-3 text-sm">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button type="button" onClick={load} className="mt-2 text-xs underline">
            {t("app.load.retry")}
          </button>
        </div>
      )}
      {!rows && !error && (
        <div className="px-4 py-4">
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        </div>
      )}
      {rows && (
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <RateRow
              key={r.memberId}
              row={r}
              onSaved={(next) => setRows((list) => list.map((x) => (x.memberId === next.memberId ? next : x)))}
            />
          ))}
          {rows.length === 0 && (
            <p className="px-4 py-4 text-sm text-muted-foreground">{t("app.commissions.noTeam")}</p>
          )}
        </div>
      )}
    </section>
  );
}
