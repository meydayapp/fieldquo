// app/app/settings/overhead/FixedCostsEditor.js
//
// The "Fixed costs" list of Settings > Overhead — the recurring overhead
// expenses, and the one-line form that adds one — as a component, because
// the home page's "Enter your overhead" dialog renders the same list
// (app/components/dashboard/stepPanels.js). It owns its own read and its
// own add and remove, against the same route in both places, so a rent line
// added from the checklist is exactly a rent line added from Settings.
//
// `onChanged` fires after a row is added or removed. The page uses it to
// re-read the minimum price the fixed costs feed; the dialog uses it to
// re-read the checklist. Neither is told what changed — both re-ask the
// server, which is the only thing that knows the totals.
//
// `titleTag`: an h2 on the page, where the section sits under the page's
// h1; an h3 in the dialog, whose own heading is the h2.
"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";

export const FIXED_COST_FREQUENCIES = ["weekly", "monthly", "yearly"];

export default function FixedCostsEditor({ onChanged, titleTag: TitleTag = "h2" }) {
  const money = useCompanyMoney();
  const { t } = useTranslation();
  const [fixedCosts, setFixedCosts] = useState([]);
  const [fixedForm, setFixedForm] = useState({
    name: "",
    amount: "",
    frequency: "monthly",
  });

  // Reported through reportResponseError like the page's legs were; a failed
  // read leaves the list empty rather than showing rows the server never sent.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/overhead/fixed-costs")
      .then(async (r) => {
        if (!r.ok) {
          await reportResponseError(r);
          return [];
        }
        return r.json();
      })
      .then((f) => {
        if (!cancelled) setFixedCosts(Array.isArray(f) ? f : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // The same sentence the page's other four lists confirm with, by key.
  function confirmDelete(what) {
    return window.confirm(
      t("app.setOverhead.deleteConfirm", "Delete {what}? This can't be undone, and your price floor changes straight away.", {
        what,
      }),
    );
  }

  async function addFixedCost(e) {
    e.preventDefault();
    const res = await fetch("/api/overhead/fixed-costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fixedForm.name,
        amount: Number(fixedForm.amount),
        frequency: fixedForm.frequency,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setFixedCosts((prev) => [created, ...prev]);
      setFixedForm({ name: "", amount: "", frequency: "monthly" });
      await onChanged?.();
    } else {
      await reportResponseError(res);
    }
  }

  async function removeFixedCost(id, label) {
    if (!confirmDelete(label)) return;
    const res = await fetch(`/api/overhead/fixed-costs/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFixedCosts((prev) => prev.filter((f) => f.id !== id));
      await onChanged?.();
    } else {
      await reportResponseError(res);
    }
  }

  return (
    <>
      <TitleTag className="font-semibold text-foreground mb-1">
        {t("app.setOverhead.fixedCosts")}
      </TitleTag>
      <p className="text-xs text-muted-foreground mb-3">
        {t("app.setOverhead.fixedCostsDesc")}
      </p>
      <div className="space-y-2 mb-3">
        {fixedCosts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("app.setOverhead.noFixedCosts")}
          </p>
        )}
        {fixedCosts.map((f) => (
          <div
            key={f.id}
            className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3 text-sm"
          >
            <span className="truncate">
              {f.category}
              {/* A recurring overhead expense saved as one-off from Settings →
                  Expense Tracking is counted as $0 a month by the burn-rate
                  calculation. It is still a row this list has to show — but
                  silently showing it under a total it contributes nothing to
                  is how a screen ends up lying about its own arithmetic. */}
              {!FIXED_COST_FREQUENCIES.includes(f.frequency) && (
                <span className="block text-[11px] text-muted-foreground">
                  {t("app.setOverhead.notCounted")}
                </span>
              )}
            </span>
            <span className="flex items-center gap-3 shrink-0">
              <span className="font-semibold tabular-nums">
                {money(f.amount)}/
                {t(`app.setOverhead.${f.frequency}`, f.frequency)}
              </span>
              <button
                type="button"
                onClick={() => removeFixedCost(f.id, f.category)}
                aria-label={t("app.action.remove")}
                className="text-muted-foreground hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </span>
          </div>
        ))}
      </div>
      <form onSubmit={addFixedCost} className="flex flex-wrap gap-2">
        <input
          placeholder={t("app.setOverhead.fixedCostNamePlaceholder")}
          value={fixedForm.name}
          onChange={(e) => setFixedForm({ ...fixedForm, name: e.target.value })}
          className="border border-border rounded px-3 py-2 text-sm flex-1 min-w-[8rem] bg-background"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder={t("app.setOverhead.amount")}
          value={fixedForm.amount}
          onChange={(e) => setFixedForm({ ...fixedForm, amount: e.target.value })}
          className="border border-border rounded px-3 py-2 text-sm w-28 bg-background"
        />
        <select
          value={fixedForm.frequency}
          onChange={(e) =>
            setFixedForm({ ...fixedForm, frequency: e.target.value })
          }
          className="border border-border rounded px-2 py-2 text-sm bg-card"
        >
          {FIXED_COST_FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {t(`app.setOverhead.${f}`)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-inverted text-inverted-foreground px-4 rounded-full"
          aria-label={t("app.setOverhead.addFixedCost")}
        >
          <Plus size={14} />
        </button>
      </form>
    </>
  );
}
