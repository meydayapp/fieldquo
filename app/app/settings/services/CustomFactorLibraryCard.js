// app/app/settings/services/CustomFactorLibraryCard.js
//
// The company's own complexity factors — "Tight access, +15%", "Crated dog,
// +1.5 h" — on Settings › Services, beside the trades' built-in complexity
// that the rows below this card describe. The same rows the quote builder's
// "Add from your library…" list opens on (CustomFactorsEditor); this card is
// where they are added and taken out without a quote open.
//
// Every write goes through /api/complexity-factors and the row shown is the
// row the route returned, so a refused save cannot leave the screen claiming
// otherwise. "Remove" archives: the route keeps the row, and the quotes that
// already carry the factor carry a copy that never pointed at it.
"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, ChevronRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson, errorText } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { LANGUAGES } from "@/app/i18n/languages";
import { CUSTOM_FACTOR_LIMITS, customFactorProblem } from "@/lib/pricing/customFactors";
import { presetValueText } from "@/app/components/pricing/CustomFactorsEditor";

const inputClass = "border border-border rounded px-2 py-1.5 text-sm bg-background text-foreground";

export default function CustomFactorLibraryCard({ canEdit }) {
  const { t, language } = useTranslation();
  const money = useCompanyMoney();
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", mode: "percent", value: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchJson("/api/complexity-factors")
      .then((list) => alive && setRows(Array.isArray(list) ? list : []))
      .catch((err) => {
        if (!alive) return;
        setRows([]);
        showError(errorText(t, err));
      });
    return () => {
      alive = false;
    };
  }, [t]);

  // The same rule the quote builder and the route apply, said before the
  // round trip. An hours preset carries no rate — it is priced at the rate of
  // whichever service it lands on — so a placeholder rate stands in here only
  // to let the shared check read the hours.
  const problem = customFactorProblem({ ...form, rate: form.mode === "hours" ? 1 : undefined });

  async function add() {
    if (problem) {
      setError(t(`app.customFactors.problem.${problem === "tooLarge" || problem === "label" || problem === "value" ? problem : "invalid"}`, { max: CUSTOM_FACTOR_LIMITS[form.mode] ?? "" }));
      return;
    }
    setBusy("add");
    setError("");
    try {
      const row = await fetchJson("/api/complexity-factors", {
        method: "POST",
        body: { label: form.label.trim(), mode: form.mode, value: Number(form.value), language },
      });
      setRows((prev) => ((prev || []).some((r) => r.id === row.id) ? prev : [...(prev || []), row]));
      setForm({ label: "", mode: form.mode, value: "" });
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy("");
    }
  }

  async function remove(row) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        t("app.customFactors.removeConfirm", "Take “{label}” out of the library? Quotes that already carry it keep their line.", { label: row.label }),
      )
    )
      return;
    setBusy(`remove:${row.id}`);
    try {
      await fetchJson(`/api/complexity-factors/${row.id}`, { method: "DELETE" });
      setRows((prev) => (prev || []).filter((r) => r.id !== row.id));
    } catch (err) {
      showError(errorText(t, err));
    } finally {
      setBusy("");
    }
  }

  const langName = (code) => LANGUAGES.find((l) => l.code === code)?.nativeName || code;

  return (
    <div className="mb-4 rounded-lg border border-border p-4 space-y-3" data-custom-factor-library-card>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-start gap-2 text-left min-w-0">
        <ChevronRight size={16} className={`shrink-0 mt-0.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            {t("app.customFactors.libraryTitle", "Your complexity factors")}
            {rows !== null && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">{rows.length}</span>
            )}
          </span>
          <span className="block text-xs text-muted-foreground">
            {t(
              "app.customFactors.libraryIntro",
              "The factors you add to quotes again and again, on any service. Pick one from the quote builder and it lands on the quote as its own line, in the words saved here.",
            )}
          </span>
        </span>
      </button>

      {open && (
        <>
          {rows === null ? (
            <div className="h-10 rounded bg-accent animate-pulse" />
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("app.customFactors.libraryEmpty", "None yet. Add one here, or press “Save to library” beside a factor on a quote.")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 break-words">
                    {row.label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {row.value == null
                        ? t("app.customFactors.pricesHidden", "Values are hidden by your access level.")
                        : presetValueText(row, money, t)}
                      {row.language && row.language !== language ? ` · ${langName(row.language)}` : ""}
                    </span>
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => remove(row)}
                      disabled={busy === `remove:${row.id}`}
                      aria-label={t("app.customFactors.libraryRemove", "Remove from library")}
                      className="shrink-0 p-1 text-muted-foreground hover:text-red-600 disabled:opacity-50"
                    >
                      {busy === `remove:${row.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2" data-custom-factor-library-form>
              <input
                value={form.label}
                maxLength={CUSTOM_FACTOR_LIMITS.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder={t("app.customFactors.labelPlaceholder", "e.g. Tight access — 3rd floor walk-up")}
                aria-label={t("app.customFactors.labelAria", "What it is")}
                className={`${inputClass} min-w-0 flex-1 basis-56`}
              />
              <select
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value })}
                className={inputClass}
                aria-label={t("app.customFactors.modeAria", "How it adjusts the price")}
              >
                <option value="percent">{t("app.customFactors.mode.percent", "% of this service")}</option>
                <option value="fixed">{t("app.customFactors.mode.fixed", "Fixed amount")}</option>
                <option value="hours">{t("app.customFactors.mode.hours", "Extra hours")}</option>
              </select>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                aria-label={t("app.customFactors.valueAria", "Amount")}
                className={`${inputClass} w-24 text-right tabular-nums`}
              />
              <button
                type="button"
                onClick={add}
                disabled={busy === "add"}
                className="inline-flex items-center gap-1 text-sm font-medium text-foreground disabled:opacity-60"
              >
                {busy === "add" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {t("app.customFactors.libraryAdd", "Add")}
              </button>
              {form.mode === "hours" && (
                <p className="basis-full text-xs text-muted-foreground">
                  {t("app.customFactors.libraryHoursNote", "Extra hours are priced at the hourly rate of the service they're added to, and only offered on services sold by the hour.")}
                </p>
              )}
            </div>
          )}
          {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
        </>
      )}
    </div>
  );
}
