"use client";

// app/components/team/OwnRateCard.js
//
// "Your own rate" — the signed-in owner's (or admin's) own hourly rate, the
// number job costing multiplies their clocked hours by. Mounted on Team →
// Workers (where every other rate is set, #own-rate) and on the Team page;
// the set-up card's pay-rates row lands here for a one-person company.
//
// Draws NOTHING for somebody who cannot set pay (the route says `show:
// false`): a card a Manager could read and never save would be a control
// that appears to work and doesn't. The rules are lib/team/ownRate.js; the
// write is app/api/me/own-rate/route.js, which never overwrites a rate the
// card did not show.
import { useCallback, useEffect, useState } from "react";
import { Loader2, Check, AlertTriangle, UserRound } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { parseOwnRate } from "@/lib/team/ownRate";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";

export default function OwnRateCard({ id = "own-rate", onSaved = null }) {
  const { t } = useTranslation();
  const money = useCompanyMoney();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const d = await fetchJson("/api/me/own-rate");
      setData(d);
      const current = d?.worker?.hourlyRate;
      // The field starts at the rate on file, or at the labelled suggestion
      // when there is none. Nothing is stored until Save.
      setValue(current != null ? String(current) : d?.suggestion?.rate != null ? String(d.suggestion.rate) : "");
    } catch (err) {
      setLoadError(err.message || t("app.ownRate.loadError", "Couldn't load your rate."));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <div id={id} className="scroll-mt-4 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground flex items-center gap-2">
        <AlertTriangle size={15} className="shrink-0" />
        <span className="flex-1">{loadError}</span>
        <button type="button" onClick={load} className="text-sm font-semibold text-foreground underline underline-offset-2">
          {t("app.action.retry", "Retry")}
        </button>
      </div>
    );
  }
  if (!data) return <div id={id} className="scroll-mt-4 h-28 rounded-xl bg-accent animate-pulse" />;
  if (!data.show) return null;

  const current = data.worker?.hourlyRate ?? null;
  const suggestion = data.suggestion;

  async function save(e) {
    e.preventDefault();
    setSaved(false);
    const parsed = parseOwnRate(value);
    if (!parsed.ok) {
      setError(t("app.ownRate.invalid", "Type an hourly rate above zero, like 45 or 52.50."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetchJson("/api/me/own-rate", {
        method: "PUT",
        body: { hourlyRate: parsed.value, expected: current },
      });
      setData((d) => ({ ...d, worker: res.worker }));
      setValue(String(res.worker.hourlyRate));
      setSaved(true);
      onSaved?.(res.worker);
    } catch (err) {
      if (err.status === 409 && err.data?.code === "changed") {
        // Somebody (or a linked Team → Workers row) already holds a rate.
        // Show it rather than overwrite it; Save again to change it.
        const now = err.data.current ?? null;
        setData((d) => ({ ...d, worker: { ...(d.worker || {}), hourlyRate: now } }));
        setValue(now != null ? String(now) : value);
        setError(
          now != null
            ? t("app.ownRate.changed", "Your rate on file is {rate} — it was set on Team → Workers. Save again to change it.", { rate: t("app.ownRate.perHour", "{rate}/h", { rate: money(now) }) })
            : t("app.ownRate.changedNone", "Your rate changed since this page loaded. Check it and save again."),
        );
      } else {
        setError(err.message || t("app.ownRate.saveError", "Couldn't save your rate."));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id={id} onSubmit={save} className="scroll-mt-4 rounded-xl border border-border bg-card p-5 space-y-3" data-own-rate>
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0">
          <UserRound size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{t("app.ownRate.title", "Your own rate")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("app.ownRate.body", "What an hour of your own time costs the business. Job costing counts the hours you clock at this rate, and quotes you're on are costed with it.")}
          </p>
        </div>
      </div>

      <p className="text-sm text-foreground" data-own-rate-current>
        {current != null
          ? t("app.ownRate.current", "On file: {rate}", { rate: t("app.ownRate.perHour", "{rate}/h", { rate: money(current) }) })
          : t("app.ownRate.none", "No rate on file — your hours cost nothing on any job yet.")}
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.setWorkers.payRate")}</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            disabled={!data.canSave || busy}
            className="mt-1 w-36 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        {data.canSave ? (
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-inverted text-inverted-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saved ? t("app.ownRate.saved", "Saved") : t("app.action.save", "Save")}
          </button>
        ) : null}
      </div>

      {current == null && suggestion ? (
        <p className="text-xs text-muted-foreground">
          {suggestion.source === "labour_cost"
            ? t("app.ownRate.suggestLabourCost", "Filled in from the labour cost on your team profile ({rate}). Nothing is saved until you press Save.", { rate: t("app.ownRate.perHour", "{rate}/h", { rate: money(suggestion.rate) }) })
            : t("app.ownRate.suggestDefault", "Filled in with FieldQuo's {rate} default — what a quote with nobody assigned is costed at today. Nothing is saved until you press Save.", { rate: t("app.ownRate.perHour", "{rate}/h", { rate: money(suggestion.rate) }) })}
        </p>
      ) : null}
      {!data.worker && data.canSave ? (
        <p className="text-xs text-muted-foreground">
          {t("app.ownRate.addsWorker", "Saving adds you to Team → Workers so your hours can be costed. It doesn't use a seat.")}
        </p>
      ) : null}
      {!data.canSave ? (
        <p className="text-xs text-muted-foreground">
          {data.reason === "read_only"
            ? t("app.ownRate.readOnly", "Read-only in a support session.")
            : t("app.ownRate.noWorker", "You're not on Team → Workers yet. Ask an owner to add you there.")}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
          <AlertTriangle size={12} /> {error}
        </p>
      ) : null}
    </form>
  );
}
