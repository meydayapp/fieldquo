"use client";

// app/components/settings/LeaveLimitsCard.js
//
// Settings → Time off policies: the company's limits ABOVE any policy —
// blackout ranges nobody may book, the most people off at once, and the
// statutory-holiday calendar the leave count follows. Company.leaveRules,
// through /api/settings/leave-rules and lib/leave/rules.js.
//
// Saved as a whole: the three are one rule set the request route reads
// together, and a half-saved blackout (dates kept, label lost) is a rule the
// owner believes exists and does not. The server validates and refuses with
// the reason; nothing is repaired silently.
//
// The holiday calendar defaults to the company's stated address and says so
// ("from your address"); choosing a region here overrides it. Neither being a
// region with a table (a company in Lyon) shows "no holiday calendar" and a
// leave request then counts every working day — which is the honest answer,
// not a Canadian calendar applied to France.

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarOff, Loader2, Plus, Trash2, Users } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { formatDateOnly } from "@/lib/format/companyDate";

const PROVINCE_NAMES = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories",
  NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Québec",
  SK: "Saskatchewan", YT: "Yukon",
};

export default function LeaveLimitsCard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await fetchJson("/api/settings/leave-rules");
      setData(d);
      setForm({
        blackouts: d.rules.blackouts.map((b) => ({ ...b })),
        maxConcurrent: d.rules.maxConcurrent == null ? "" : String(d.rules.maxConcurrent),
        // "" = follow the address; else "CA-ON" / "US".
        region: d.rules.holidayRegion
          ? `${d.rules.holidayRegion.country}${d.rules.holidayRegion.province ? `-${d.rules.holidayRegion.province}` : ""}`
          : "",
      });
      setError("");
    } catch (err) {
      setError(err.message);
      setData(null);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setError("");
    setSaved(false);
    let holidayRegion = null;
    if (form.region) {
      const [country, province] = form.region.split("-");
      holidayRegion = { country, province: province || null };
    }
    try {
      const d = await fetchJson("/api/settings/leave-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blackouts: form.blackouts,
          maxConcurrent: form.maxConcurrent === "" ? null : Number(form.maxConcurrent),
          holidayRegion,
        }),
      });
      setData(d);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const regionOptions = [];
  if (data?.regions) {
    for (const p of data.regions.CA || []) regionOptions.push({ value: `CA-${p}`, label: `Canada — ${PROVINCE_NAMES[p] || p}` });
    regionOptions.push({ value: "US", label: t("app.setLeave.limits.usFederal") });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <CalendarOff size={16} /> {t("app.setLeave.limits.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("app.setLeave.limits.intro")}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {!form ? (
        !error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> {t("app.state.loading")}
          </div>
        )
      ) : (
        <>
          {/* ── Blackouts ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t("app.setLeave.limits.blackouts")}</h3>
            <p className="text-xs text-muted-foreground">{t("app.setLeave.limits.blackoutsHelp")}</p>
            {form.blackouts.length === 0 && (
              <p className="text-xs text-muted-foreground italic">{t("app.setLeave.limits.noBlackouts")}</p>
            )}
            {form.blackouts.map((b, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto] items-end">
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">{t("app.setLeave.limits.from")}</span>
                  <input
                    type="date"
                    value={b.from}
                    onChange={(e) => setForm((f) => ({ ...f, blackouts: f.blackouts.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) }))}
                    className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">{t("app.setLeave.limits.to")}</span>
                  <input
                    type="date"
                    value={b.to}
                    onChange={(e) => setForm((f) => ({ ...f, blackouts: f.blackouts.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) }))}
                    className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">{t("app.setLeave.limits.label")}</span>
                  <input
                    type="text"
                    maxLength={80}
                    value={b.label}
                    placeholder={t("app.setLeave.limits.labelPlaceholder")}
                    onChange={(e) => setForm((f) => ({ ...f, blackouts: f.blackouts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))}
                    className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, blackouts: f.blackouts.filter((_, j) => j !== i) }))}
                  aria-label={t("app.action.remove")}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, blackouts: [...f.blackouts, { from: "", to: "", label: "" }] }))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm"
            >
              <Plus size={14} /> {t("app.setLeave.limits.addBlackout")}
            </button>
          </div>

          {/* ── Max off at once ───────────────────────────────────────── */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Users size={14} /> {t("app.setLeave.limits.maxOff")}
            </h3>
            <p className="text-xs text-muted-foreground">{t("app.setLeave.limits.maxOffHelp")}</p>
            <input
              type="number"
              min={1}
              max={500}
              step={1}
              value={form.maxConcurrent}
              placeholder={t("app.setLeave.limits.noLimit")}
              onChange={(e) => setForm((f) => ({ ...f, maxConcurrent: e.target.value }))}
              className="mt-1 w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* ── Holiday calendar ──────────────────────────────────────── */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">{t("app.setLeave.limits.holidays")}</h3>
            <p className="text-xs text-muted-foreground">{t("app.setLeave.limits.holidaysHelp")}</p>
            <select
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
              className="mt-1 w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t("app.setLeave.limits.fromAddress")}</option>
              {regionOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {data?.effectiveRegion ? (
              <p className="text-xs text-muted-foreground">
                {t("app.setLeave.limits.following", {
                  region: data.effectiveRegion.country === "US" ? t("app.setLeave.limits.usFederal") : `Canada — ${PROVINCE_NAMES[data.effectiveRegion.province] || data.effectiveRegion.province}`,
                })}
                {data.fromAddress ? ` ${t("app.setLeave.limits.fromAddressNote")}` : ""}
              </p>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-300">{t("app.setLeave.limits.noCalendar")}</p>
            )}
            {data?.holidays?.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  {t("app.setLeave.limits.showHolidays", { n: data.holidays.length })}
                </summary>
                <ul className="mt-2 grid gap-x-4 gap-y-0.5 sm:grid-cols-2 text-xs text-foreground">
                  {data.holidays.map((h) => (
                    <li key={`${h.key}-${h.date}`} className="flex justify-between gap-2">
                      <span>{t(`app.holiday.${h.key}`, h.name)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatDateOnly(h.observed)}
                        {h.observed !== h.date ? ` (${t("app.setLeave.limits.observed")})` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-inverted text-inverted-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {t("app.setLeave.limits.save")}
            </button>
            {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400">{t("app.setLeave.limits.saved")}</span>}
          </div>
        </>
      )}
    </section>
  );
}
