"use client";

// app/components/settings/UsTaxCard.js
//
// Settings → Tax → "United States sales tax": one paragraph on what happens
// automatically, the month of the ZIP rates table, and the company's own
// word per state. Shown only when the company touches the US at all (its
// own address, a US client on file, or an override already saved) — a
// Canadian company that has never quoted a US address sees nothing new.
//
// The overrides live on the same form the rest of the page saves, so there
// is one Save and one PATCH (app/api/settings/business-info). Each row is
// a state, a treatment and, for "charge this rate", the rate; "back to
// automatic" removes the row, which is how a state returns to the tables.

import { useTranslation } from "@/app/hooks/useTranslation";
import { US_TAXABILITY, US_STATES } from "@/lib/tax/usTaxability";
import { numberLocaleFor } from "@/app/i18n/numberLocale";

export default function UsTaxCard({ overrides, onChange, ratesTable, lang }) {
  const { t } = useTranslation();
  const rows = Object.entries(overrides || {});
  const used = new Set(rows.map(([state]) => state));
  const free = US_STATES.filter((s) => !used.has(s));

  const month = ratesTable?.fetchedAt
    ? new Date(ratesTable.fetchedAt).toLocaleDateString(numberLocaleFor(lang), {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

  const update = (state, patch) =>
    onChange({ ...overrides, [state]: { ...(overrides?.[state] || {}), ...patch } });
  const remove = (state) => {
    const next = { ...overrides };
    delete next[state];
    onChange(next);
  };
  const add = () => {
    if (!free.length) return;
    onChange({ ...overrides, [free[0]]: { mode: "none" } });
  };
  const move = (from, to) => {
    if (from === to || used.has(to)) return;
    const next = {};
    for (const [s, v] of rows) next[s === from ? to : s] = v;
    onChange(next);
  };

  const labourWord = (state) => {
    const row = US_TAXABILITY[state];
    if (!row) return "";
    return t(
      row.labour === "exempt"
        ? "app.settings.usTax.labourExempt"
        : row.labour === "taxable"
          ? "app.settings.usTax.labourTaxable"
          : "app.settings.usTax.labourDepends",
    );
  };

  return (
    <div className="space-y-4" data-testid="us-tax-card">
      <div>
        <p className="text-sm font-semibold text-foreground">{t("app.settings.usTax.title")}</p>
        <p className="text-sm text-muted-foreground mt-1">{t("app.settings.usTax.body")}</p>
        <p className="text-xs text-muted-foreground mt-2">
          {ratesTable && month
            ? t("app.settings.usTax.ratesMonth", {
                month,
                states: ratesTable.states,
                rows: ratesTable.rows,
              })
            : t("app.settings.usTax.ratesMissing")}
        </p>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">{t("app.settings.usTax.overridesTitle")}</p>
        <p className="text-xs text-muted-foreground mt-1">{t("app.settings.usTax.overridesBody")}</p>
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(([state, value]) => (
            <div
              key={state}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2"
            >
              <label className="text-xs text-muted-foreground">
                {t("app.settings.usTax.state")}
                <select
                  className="ml-1.5 border border-border rounded-lg px-2 py-1 text-sm bg-background"
                  value={state}
                  onChange={(e) => move(state, e.target.value)}
                >
                  {[state, ...free].map((s) => (
                    <option key={s} value={s}>
                      {US_TAXABILITY[s]?.label || s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                {t("app.settings.usTax.mode")}
                <select
                  className="ml-1.5 border border-border rounded-lg px-2 py-1 text-sm bg-background"
                  value={value.mode || "none"}
                  onChange={(e) =>
                    update(state, e.target.value === "rate" ? { mode: "rate", rate: value.rate ?? "" } : { mode: "none" })
                  }
                >
                  <option value="none">{t("app.settings.usTax.modeNone")}</option>
                  <option value="rate">{t("app.settings.usTax.modeRate")}</option>
                </select>
              </label>
              {value.mode === "rate" && (
                <label className="text-xs text-muted-foreground">
                  {t("app.settings.usTax.rate")}
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="30"
                    className="ml-1.5 border border-border rounded-lg px-2 py-1 text-sm w-24 bg-background"
                    value={value.rate ?? ""}
                    onChange={(e) => update(state, { rate: e.target.value })}
                  />
                </label>
              )}
              <span className="text-xs text-muted-foreground basis-full">
                {t("app.settings.usTax.automaticRule", { rule: `${labourWord(state)} — ${US_TAXABILITY[state]?.rule || ""}` })}
              </span>
              <button
                type="button"
                className="text-xs underline text-muted-foreground"
                onClick={() => remove(state)}
              >
                {t("app.settings.usTax.remove")}
              </button>
            </div>
          ))}
        </div>
      )}

      {free.length > 0 && (
        <button
          type="button"
          className="text-sm font-medium underline text-foreground"
          onClick={add}
        >
          {t("app.settings.usTax.add")}
        </button>
      )}
    </div>
  );
}
