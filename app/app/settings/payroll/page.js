// app/app/settings/payroll/page.js
//
// Settings → Payroll. The deductions and allowances that turn a gross pay run
// into net pay. Until something is set up here, pay runs are gross-only and say
// so — this page is what closes that gap.
//
// ── The honesty this page has to carry ──────────────────────────────────────
//
// FieldQuo does the arithmetic; the company owns the rates. The regional
// templates are published figures for a stated year offered as a STARTING
// POINT, not FieldQuo's opinion of what anyone owes — and the page says that
// plainly, next to the button, with the year visible. Anything else would let
// someone assume these numbers are maintained for them.
//
// Mobile-first: cards stack, inputs are full-width under `sm`, and the tax-band
// editor is a scrollable list rather than a wide table.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Wallet,
  Info,
  Percent,
  Hash,
  BarChart3,
  Check,
  X,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import PayCycleCard from "@/app/components/settings/PayCycleCard";
import { showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";

const CALC_META = {
  fixed: {
    label: "Fixed amount",
    icon: Hash,
    hint: "Same amount every pay period",
  },
  percent: {
    label: "Percent of gross",
    icon: Percent,
    hint: "e.g. CPP at 5.95%",
  },
  slabs: {
    label: "Progressive bands",
    icon: BarChart3,
    hint: "Income tax brackets",
  },
};

function blankComponent() {
  return {
    name: "",
    kind: "deduction",
    calculation: "fixed",
    amount: "",
    percent: "",
    slabs: [{ upTo: "", percent: "" }],
    appliesToAll: true,
    statutory: false,
  };
}

// The band editor. Kept simple: an ordered list where the last row's "up to" is
// left blank to mean "and above".
function SlabEditor({ slabs, onChange }) {
  const { t } = useTranslation();
  function update(i, field, value) {
    const next = slabs.map((s, j) => (j === i ? { ...s, [field]: value } : s));
    onChange(next);
  }
  return (
    <div className="space-y-2">
      {slabs.map((s, i) => (
        <div key={i} className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground w-12 shrink-0">
            {i === 0
              ? t("app.setPayroll.slabUpTo")
              : t("app.setPayroll.slabThenTo")}
          </span>
          <input
            type="number"
            value={s.upTo ?? ""}
            onChange={(e) => update(i, "upTo", e.target.value)}
            placeholder={
              i === slabs.length - 1 ? t("app.setPayroll.andAbove") : "55867"
            }
            className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            step="0.01"
            value={s.percent ?? ""}
            onChange={(e) => update(i, "percent", e.target.value)}
            placeholder="%"
            className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-muted-foreground">%</span>
          {slabs.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(slabs.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-red-600"
              aria-label={t("app.setPayroll.removeBand")}
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...slabs, { upTo: "", percent: "" }])}
        className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <Plus size={12} /> {t("app.setPayroll.addBand")}
      </button>
      <p className="text-[11px] text-muted-foreground">
        {t("app.setPayroll.slabHint")}
      </p>
    </div>
  );
}

// ── Hidden, not read-only ──────────────────────────────────────────────────
//
// GET /api/settings/payroll-components has always answered 403 to anyone who
// isn't an owner or admin, so this page never showed an employee anything — it
// showed them an error where a screen should be, reached from a sidebar row
// that promised otherwise. The row is gone now
// (lib/permissions/settingsAccess.js) and typing the URL says who to ask.
//
// Read-only was never a candidate: deduction rates and tax bands decide what
// lands in someone's bank account, and one employee reading the company's
// payroll configuration is the incident lib/permissions.js warns about.
export default function PayrollSettingsPage() {
  const access = useSettingsAccess();
  if (!access.canSee("payroll")) return <NoAccessPanel capability="payroll" />;
  return <PayrollSettingsScreen />;
}

function PayrollSettingsScreen() {
  const money = useCompanyMoney();
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null); // new component being added

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/settings/payroll-components"));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function seed(region) {
    setBusy(true);
    try {
      const r = await fetchJson("/api/settings/payroll-components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedRegion: region }),
      });
      await load();
      if (r.created === 0) showError(t("app.setPayroll.seedNoChange"));
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    try {
      await fetchJson("/api/settings/payroll-components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setDraft(null);
      await load();
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id, patchBody) {
    setBusy(true);
    try {
      await fetchJson("/api/settings/payroll-components", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patchBody }),
      });
      await load();
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id, name) {
    if (!confirm(t("app.setPayroll.removeConfirm", { name }))) return;
    setBusy(true);
    try {
      await fetchJson(`/api/settings/payroll-components?id=${id}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <p className="text-sm rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 px-3 py-2">
          {error}
        </p>
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

  const components = data.components || [];
  const deductions = components.filter((c) => c.kind === "deduction");
  const earnings = components.filter((c) => c.kind === "earning");

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-7 pb-16">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Wallet size={20} className="text-foreground" />
          <h1 className="text-2xl font-bold text-foreground">
            {t("app.setPayroll.title")}
          </h1>
        </div>

        {/* When the company pays. Sits above the salary components because it is
          the thing they are computed FOR — and because nothing else in the
          product knew the answer, which is why a worker could not be shown
          what they had earned so far. */}
        <PayCycleCard />
        <p className="text-sm text-muted-foreground">
          {t("app.setPayroll.subtitle")}
        </p>
      </div>

      {/* Seed from a regional template */}
      {components.length === 0 && (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-sm font-bold text-foreground mb-1">
            {t("app.setPayroll.startRegion")}
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            {t("app.setPayroll.regionDesc1")}{" "}
            <strong className="text-foreground">
              {t("app.setPayroll.regionDescStrong")}
            </strong>{" "}
            {t("app.setPayroll.regionDesc2")}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {(data.templates || []).map((tpl) => (
              <button
                key={tpl.key}
                onClick={() => seed(tpl.key)}
                disabled={busy}
                className="flex-1 rounded-lg border border-border px-3 py-2.5 text-left hover:bg-muted disabled:opacity-60"
              >
                <div className="text-sm font-semibold text-foreground">
                  {tpl.label}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {t("app.setPayroll.templateMeta", {
                    count: tpl.count,
                    year: tpl.sourceYear,
                  })}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Existing components */}
      {[
        [t("app.setPayroll.deductions"), deductions],
        [t("app.setPayroll.allowancesEarnings"), earnings],
      ].map(
        ([title, list]) =>
          list.length > 0 && (
            <section key={title}>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                {title}
              </h2>
              <div className="space-y-2">
                {list.map((c) => {
                  const Meta = CALC_META[c.calculation] || CALC_META.fixed;
                  const Icon = Meta.icon;
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Icon
                              size={14}
                              className="text-muted-foreground shrink-0"
                            />
                            <span className="text-sm font-semibold text-foreground">
                              {c.name}
                            </span>
                            {c.statutory && (
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {t("app.setPayroll.statutory")}
                              </span>
                            )}
                            {!c.active && (
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">
                                {t("app.setPayroll.off")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {c.calculation === "percent"
                              ? t("app.setPayroll.percentOfGross", {
                                  percent: Number(c.percent),
                                })
                              : c.calculation === "slabs"
                                ? t("app.setPayroll.progressiveBands", {
                                    count: (c.slabs || []).length,
                                  })
                                : money(c.amount)}
                            {c.appliesToAll
                              ? t("app.setPayroll.everyone")
                              : t("app.setPayroll.assignedIndividually")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => patch(c.id, { active: !c.active })}
                            disabled={busy}
                            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                          >
                            {c.active
                              ? t("app.setPayroll.turnOff")
                              : t("app.setPayroll.turnOn")}
                          </button>
                          <button
                            onClick={() => remove(c.id, c.name)}
                            disabled={busy}
                            className="text-muted-foreground hover:text-red-600"
                            aria-label={t("app.action.remove")}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Inline rate edit — the thing people come back here to change */}
                      {c.calculation !== "slabs" && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {c.calculation === "percent"
                              ? t("app.setPayroll.percent")
                              : t("app.setPayroll.amount")}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={
                              c.calculation === "percent"
                                ? Number(c.percent)
                                : Number(c.amount)
                            }
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (!Number.isFinite(v) || v < 0) return;
                              patch(c.id, {
                                calculation: c.calculation,
                                ...(c.calculation === "percent"
                                  ? { percent: v }
                                  : { amount: v }),
                              });
                            }}
                            className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                          />
                          {c.calculation === "percent" && (
                            <span className="text-xs text-muted-foreground">
                              %
                            </span>
                          )}
                        </div>
                      )}
                      {c.calculation === "slabs" && (
                        <details className="mt-3">
                          <summary className="text-xs font-semibold text-muted-foreground cursor-pointer">
                            {t("app.setPayroll.bandsViewEdit", {
                              count: (c.slabs || []).length,
                            })}
                          </summary>
                          <div className="mt-2">
                            <SlabEditor
                              slabs={(c.slabs || []).map((s) => ({
                                upTo: s.upTo ?? "",
                                percent: s.percent,
                              }))}
                              onChange={(slabs) =>
                                patch(c.id, { calculation: "slabs", slabs })
                              }
                            />
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ),
      )}

      {/* Add new */}
      {draft ? (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-bold text-foreground">
            {t("app.setPayroll.newComponent")}
          </h2>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={t("app.setPayroll.namePlaceholder")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2 flex-wrap">
            {["deduction", "earning"].map((k) => (
              <button
                key={k}
                onClick={() => setDraft({ ...draft, kind: k })}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                  draft.kind === k
                    ? "border-foreground bg-inverted text-inverted-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {k === "deduction"
                  ? t("app.setPayroll.deduction")
                  : t("app.setPayroll.allowanceEarning")}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(CALC_META).map(([key, m]) => (
              <button
                key={key}
                onClick={() => setDraft({ ...draft, calculation: key })}
                title={t(`app.setPayroll.calc.${key}.hint`)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                  draft.calculation === key
                    ? "border-foreground bg-inverted text-inverted-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {t(`app.setPayroll.calc.${key}.label`)}
              </button>
            ))}
          </div>

          {draft.calculation === "fixed" && (
            <input
              type="number"
              step="0.01"
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              placeholder={t("app.setPayroll.amountPerPeriod")}
              className="w-full sm:w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          )}
          {draft.calculation === "percent" && (
            <input
              type="number"
              step="0.01"
              value={draft.percent}
              onChange={(e) => setDraft({ ...draft, percent: e.target.value })}
              placeholder={t("app.setPayroll.percentPlaceholder")}
              className="w-full sm:w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          )}
          {draft.calculation === "slabs" && (
            <SlabEditor
              slabs={draft.slabs}
              onChange={(slabs) => setDraft({ ...draft, slabs })}
            />
          )}

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={draft.appliesToAll}
              onChange={(e) =>
                setDraft({ ...draft, appliesToAll: e.target.checked })
              }
            />
            {t("app.setPayroll.applyEveryone")}
          </label>

          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={busy || !draft.name.trim()}
              className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              {t("app.action.add")}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
            >
              {t("app.action.cancel")}
            </button>
          </div>
        </section>
      ) : (
        <button
          onClick={() => setDraft(blankComponent())}
          className="inline-flex items-center gap-2 border border-border rounded-full px-4 py-2 text-sm font-semibold"
        >
          <Plus size={14} /> {t("app.setPayroll.addComponent")}
        </button>
      )}

      <p className="text-xs text-muted-foreground flex items-start gap-1.5 border-t border-border pt-4">
        <Info size={13} className="mt-0.5 shrink-0" />
        {t("app.setPayroll.footerNote")}
      </p>
    </div>
  );
}
