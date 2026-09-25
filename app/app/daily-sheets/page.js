// app/app/daily-sheets/page.js
//
// The coordinator's daily sheet, one card per crew member per day:
// objectives (from the job plan's tasks when it has any for them, else
// typed), before/after photos, the clock stamps read live from TimeEntry,
// upsells credited, the end-of-day evaluation, and the bonus the company's
// rule yields — or the sentence saying there is no rule.
//
// Who sees what is decided by the route (lib/dailySheets/access.js): a
// coordinator gets every crew member and the evaluation box; a crew member
// gets their own sheet, may fill in results, photos and upsells, and reads
// the evaluation. This page draws what the route returned and never widens
// it — `coordinator` in the payload only decides whether the score box is
// an input or a sentence.
//
// Cached by public/sw.js so the sheet opens in the field; writes made
// without signal are refused with the ordinary error — the sheet is not
// on the offline queue (only invoices, punches and their photos are).
"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Plus, X, Camera, Award, CalendarDays } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { uploadFile } from "@/lib/media/uploadClient";
import { showError } from "@/lib/clientErrors";
import { showToast } from "@/lib/toast";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { OBJECTIVE_STATUSES } from "@/lib/dailySheets/objectives";

const shiftDay = (key, days) => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
};
const fmtTime = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");

export default function DailySheetsPage() {
  return (
    <Suspense fallback={<div className="p-4 sm:p-6 max-w-4xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />}>
      <DailySheetsScreen />
    </Suspense>
  );
}

function DailySheetsScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get("date") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchJson(`/api/daily-sheets${date ? `?date=${encodeURIComponent(date)}` : ""}`));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [date]);
  useEffect(() => {
    load();
  }, [load]);

  const go = (key) => router.push(`/app/daily-sheets?date=${key}`);
  const shown = data?.date || date;
  const dayLabel = shown
    ? new Date(`${shown}T12:00:00Z`).toLocaleDateString(language, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })
    : "";

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.dailySheet.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("app.dailySheet.subtitle")}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shown && go(shiftDay(shown, -1))} aria-label={t("app.dailySheet.prevDay")} className="p-2 rounded-lg border border-border">
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={shown}
            onChange={(e) => e.target.value && go(e.target.value)}
            className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
          />
          <button type="button" onClick={() => shown && go(shiftDay(shown, 1))} aria-label={t("app.dailySheet.nextDay")} className="p-2 rounded-lg border border-border">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      {!data && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> {t("app.state.loading")}
        </div>
      )}
      {data && data.rows.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">{t("app.dailySheet.nobody", { day: dayLabel })}</div>
      )}
      {data &&
        data.rows.map((row) => (
          <SheetCard key={row.worker.id} row={row} date={data.date} dayLabel={dayLabel} coordinator={data.coordinator} hasRule={data.hasRule} onSaved={load} />
        ))}
    </div>
  );
}

function SheetCard({ row, date, dayLabel, coordinator, hasRule, onSaved }) {
  const { t } = useTranslation();
  const money = useCompanyMoney();
  const sheet = row.sheet;
  const [objectives, setObjectives] = useState(() => (sheet?.objectives?.length ? sheet.objectives : row.suggestedObjectives));
  const [upsells, setUpsells] = useState(() => sheet?.upsells || []);
  const [jobId, setJobId] = useState(() => sheet?.jobId || row.jobs[0]?.id || "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [score, setScore] = useState(sheet?.evaluationScore || 0);
  const [note, setNote] = useState(sheet?.evaluationNote || "");
  const [upsellOptions, setUpsellOptions] = useState(null);
  const [newObjective, setNewObjective] = useState("");
  const [typedUpsell, setTypedUpsell] = useState({ description: "", amount: "" });

  useEffect(() => {
    setObjectives(sheet?.objectives?.length ? sheet.objectives : row.suggestedObjectives);
    setUpsells(sheet?.upsells || []);
    setScore(sheet?.evaluationScore || 0);
    setNote(sheet?.evaluationNote || "");
    setDirty(false);
  }, [sheet, row.suggestedObjectives]);

  const clock = useMemo(() => {
    const entries = row.entries || [];
    if (!entries.length) return null;
    const first = entries[0];
    const last = entries[entries.length - 1];
    const hours = entries.reduce((s, e) => s + (Number(e.hours) || 0), 0);
    const open = entries.some((e) => !e.clockOut);
    return { inAt: first.clockIn, outAt: open ? null : last.clockOut, hours: Math.round(hours * 100) / 100, open };
  }, [row.entries]);

  const frozen = Boolean(sheet?.payRunId);

  const updateObjective = (id, patch) => {
    setObjectives((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    setDirty(true);
  };

  async function uploadPhoto(file) {
    try {
      const data = await uploadFile(file, { purpose: "jobs" });
      return data.url;
    } catch (err) {
      throw new Error(err?.message || t("app.dailySheet.photoFailed"));
    }
  }

  async function save() {
    setSaving(true);
    try {
      await fetchJson("/api/daily-sheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: row.worker.id, date, jobId: jobId || null, objectives, upsells }),
      });
      setDirty(false);
      showToast({ message: t("app.dailySheet.saved"), tone: "success" });
      onSaved();
    } catch (err) {
      showError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function evaluate() {
    if (!score) return;
    setSaving(true);
    try {
      if (dirty) await save();
      const out = await fetchJson("/api/daily-sheets/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: row.worker.id, date, score, note }),
      });
      showToast({ message: out.noRule ? t("app.dailySheet.evaluatedNoRule") : t("app.dailySheet.evaluated"), tone: "success" });
      onSaved();
    } catch (err) {
      showError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadUpsellOptions() {
    if (!jobId) {
      setUpsellOptions([]);
      return;
    }
    try {
      const d = await fetchJson(`/api/daily-sheets/upsells?jobId=${encodeURIComponent(jobId)}`);
      setUpsellOptions(d.options || []);
    } catch (err) {
      showError(err.message);
    }
  }

  const bonusLines = Array.isArray(sheet?.bonusBreakdown) ? sheet.bonusBreakdown : [];
  const jobTitle = row.jobs.find((j) => j.id === jobId)?.title || sheet?.job?.title || "";

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-foreground">
            {t("app.dailySheet.cardTitle", { name: row.worker.name })}{" "}
            <span className="font-normal text-muted-foreground text-sm">
              {dayLabel}
              {jobTitle ? ` · ${jobTitle}` : ""}
            </span>
          </h2>
          {row.jobs.length > 1 && (
            <select value={jobId} onChange={(e) => { setJobId(e.target.value); setDirty(true); }} className="mt-1 border border-border rounded-lg px-2 py-1 text-xs bg-background">
              {row.jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {clock ? (
            <span className="inline-flex items-center rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 px-3 py-1 text-xs font-semibold">
              {clock.open
                ? t("app.dailySheet.clockOpen", { in: fmtTime(clock.inAt) })
                : t("app.dailySheet.clockPill", { in: fmtTime(clock.inAt), out: fmtTime(clock.outAt), hours: clock.hours })}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-3 py-1 text-xs font-semibold">{t("app.dailySheet.noClock")}</span>
          )}
          <Link href={`/app/daily-sheets/week?workerId=${row.worker.id}&weekOf=${date}`} className="inline-flex items-center gap-1 text-xs font-semibold underline">
            <CalendarDays size={12} /> {t("app.dailySheet.thisWeek")}
          </Link>
        </div>
      </div>

      {/* Objectives */}
      <div className="space-y-2">
        <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="sm:col-span-5">{t("app.dailySheet.objective")}</span>
          <span className="sm:col-span-1 text-right">{t("app.dailySheet.planned")}</span>
          <span className="sm:col-span-3">{t("app.dailySheet.result")}</span>
          <span className="sm:col-span-3">{t("app.dailySheet.photos")}</span>
        </div>
        {objectives.length === 0 && <p className="text-sm text-muted-foreground">{t("app.dailySheet.noObjectives")}</p>}
        {objectives.map((o) => (
          <div key={o.id} className="rounded-lg border border-border p-2 sm:p-0 sm:border-0 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center space-y-2 sm:space-y-0">
            <div className="sm:col-span-5 min-w-0">
              <div className="text-sm text-foreground">{o.title}</div>
              {o.taskId ? <div className="text-[11px] text-muted-foreground">{t("app.dailySheet.fromPlan")}</div> : null}
            </div>
            <div className="sm:col-span-1 text-sm text-right tabular-nums text-muted-foreground">{o.plannedHours != null ? `${o.plannedHours} h` : "—"}</div>
            <div className="sm:col-span-3 flex items-center gap-1">
              <select disabled={frozen} value={o.status} onChange={(e) => updateObjective(o.id, { status: e.target.value })} className="border border-border rounded-lg px-2 py-1 text-xs bg-background flex-1">
                {OBJECTIVE_STATUSES.map((s) => (
                  <option key={s} value={s}>{t(`app.dailySheet.status.${s}`)}</option>
                ))}
              </select>
              <input type="number" min="0" max="24" step="0.1" disabled={frozen} value={o.actualHours ?? ""} placeholder="h" onChange={(e) => updateObjective(o.id, { actualHours: e.target.value === "" ? null : Number(e.target.value) })} className="w-14 border border-border rounded-lg px-1.5 py-1 text-xs bg-background" />
            </div>
            <div className="sm:col-span-3 flex items-center gap-2">
              <PhotoSlot label={t("app.dailySheet.before")} url={o.beforePhoto} disabled={frozen} onPick={async (f) => updateObjective(o.id, { beforePhoto: await uploadPhoto(f) })} />
              <PhotoSlot label={t("app.dailySheet.after")} url={o.afterPhoto} disabled={frozen} onPick={async (f) => updateObjective(o.id, { afterPhoto: await uploadPhoto(f) })} />
              {!frozen && (
                <button type="button" onClick={() => { setObjectives((l) => l.filter((x) => x.id !== o.id)); setDirty(true); }} aria-label={t("app.dailySheet.removeObjective")} className="text-muted-foreground ml-auto">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        {!frozen && (
          <div className="flex items-center gap-2">
            <input value={newObjective} onChange={(e) => setNewObjective(e.target.value)} placeholder={t("app.dailySheet.typeObjective")} className="flex-1 border border-border rounded-lg px-2 py-1.5 text-sm bg-background" />
            <button
              type="button"
              disabled={!newObjective.trim()}
              onClick={() => {
                setObjectives((l) => [...l, { id: `o${Date.now().toString(36)}`, title: newObjective.trim(), taskId: null, plannedHours: null, status: "planned", actualHours: null, note: "", beforePhoto: null, afterPhoto: null }]);
                setNewObjective("");
                setDirty(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold border border-border rounded-lg px-2 py-1.5 disabled:opacity-50"
            >
              <Plus size={12} /> {t("app.dailySheet.addObjective")}
            </button>
          </div>
        )}
      </div>

      {/* Upsells */}
      <div className="space-y-2">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("app.dailySheet.upsells")}</div>
        {upsells.length === 0 && <p className="text-xs text-muted-foreground">{t("app.dailySheet.noUpsells")}</p>}
        {upsells.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <span className="text-foreground">{u.description}</span>
              <span className="text-[11px] text-muted-foreground ml-2">{u.quoteAddOnId ? t("app.dailySheet.linkedAddOn") : u.changeOrderId ? t("app.dailySheet.linkedChangeOrder") : t("app.dailySheet.typedUpsell")}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="tabular-nums font-medium">+{money((u.amountCents || 0) / 100)}</span>
              {!frozen && (
                <button type="button" onClick={() => { setUpsells((l) => l.filter((x) => x.id !== u.id)); setDirty(true); }} aria-label={t("app.dailySheet.removeUpsell")} className="text-muted-foreground">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        {!frozen && (
          <div className="space-y-2">
            {upsellOptions === null ? (
              <button type="button" onClick={loadUpsellOptions} className="text-xs font-semibold underline">{t("app.dailySheet.pickUpsell")}</button>
            ) : upsellOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("app.dailySheet.noLinkedUpsells")}</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {upsellOptions.map((opt) => {
                  const key = opt.quoteAddOnId ? `addon:${opt.quoteAddOnId}` : `co:${opt.changeOrderId}`;
                  const taken = upsells.some((u) => (u.quoteAddOnId && `addon:${u.quoteAddOnId}` === key) || (u.changeOrderId && `co:${u.changeOrderId}` === key));
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={taken}
                      onClick={() => { setUpsells((l) => [...l, { id: `u${Date.now().toString(36)}`, ...opt }]); setDirty(true); }}
                      className="text-xs border border-border rounded-full px-2 py-1 disabled:opacity-50"
                    >
                      + {opt.description} · {money(opt.amountCents / 100)}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <input value={typedUpsell.description} onChange={(e) => setTypedUpsell((u) => ({ ...u, description: e.target.value }))} placeholder={t("app.dailySheet.typeUpsell")} className="flex-1 min-w-[10rem] border border-border rounded-lg px-2 py-1.5 text-sm bg-background" />
              <input type="number" min="0" step="0.01" value={typedUpsell.amount} onChange={(e) => setTypedUpsell((u) => ({ ...u, amount: e.target.value }))} placeholder="0.00" className="w-24 border border-border rounded-lg px-2 py-1.5 text-sm bg-background" />
              <button
                type="button"
                disabled={!typedUpsell.description.trim()}
                onClick={() => {
                  setUpsells((l) => [...l, { id: `u${Date.now().toString(36)}`, description: typedUpsell.description.trim(), amountCents: Math.round(Number(typedUpsell.amount || 0) * 100), quoteAddOnId: null, changeOrderId: null }]);
                  setTypedUpsell({ description: "", amount: "" });
                  setDirty(true);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold border border-border rounded-lg px-2 py-1.5 disabled:opacity-50"
              >
                <Plus size={12} /> {t("app.dailySheet.addUpsell")}
              </button>
            </div>
          </div>
        )}
      </div>

      {!frozen && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={saving || !dirty} className="bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60">
            {saving ? t("app.action.saving") : t("app.dailySheet.saveSheet")}
          </button>
          {dirty && <span className="text-xs text-muted-foreground">{t("app.dailySheet.unsaved")}</span>}
        </div>
      )}
      {frozen && <p className="text-xs text-muted-foreground">{t("app.dailySheet.frozen")}</p>}

      {/* Evaluation + performance pay */}
      <div className="grid sm:grid-cols-2 gap-3 pt-3 border-t border-border">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{t("app.dailySheet.evaluation")}</div>
          {coordinator && !frozen ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setScore(n)} className={`w-9 h-9 rounded-lg border text-sm font-semibold ${score === n ? "bg-inverted text-inverted-foreground border-inverted" : "border-border"}`} aria-label={t("app.dailySheet.scoreN", { n })}>
                    {n}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground ml-1">/ 5</span>
              </div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={t("app.dailySheet.notePlaceholder")} className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background resize-none" />
              <button type="button" onClick={evaluate} disabled={saving || !score} className="border border-border px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60">
                {t("app.dailySheet.saveEvaluation")}
              </button>
            </div>
          ) : sheet?.evaluationScore ? (
            <div className="text-sm rounded-lg bg-muted px-3 py-2">
              <span className="font-semibold">{sheet.evaluationScore} / 5</span>
              {sheet.evaluationNote ? ` — ${sheet.evaluationNote}` : ""}
              {sheet.evaluatedBy?.name ? <span className="text-xs text-muted-foreground"> · {sheet.evaluatedBy.name}</span> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("app.dailySheet.notEvaluated")}</p>
          )}
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
            <Award size={11} /> {t("app.dailySheet.performancePay")}
          </div>
          {!hasRule ? (
            <p className="text-sm text-muted-foreground">
              {t("app.dailySheet.noRule")}{" "}
              {coordinator && (
                <Link href="/app/settings/field-work" className="underline">{t("app.dailySheet.setRule")}</Link>
              )}
            </p>
          ) : sheet?.bonusCents == null ? (
            <p className="text-sm text-muted-foreground">{t("app.dailySheet.bonusAfterEvaluation")}</p>
          ) : (
            <div className="text-sm rounded-lg bg-muted px-3 py-2 space-y-0.5">
              {bonusLines.map((l, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span>
                    {l.key === "per_objective" && t("app.dailySheet.bonus.perObjective", { count: l.count })}
                    {l.key === "all_done" && t("app.dailySheet.bonus.allDone")}
                    {l.key === "upsell" && t("app.dailySheet.bonus.upsell", { pct: l.pct, base: money((l.base || 0) / 100) })}
                    {l.key === "below_min_score" && t("app.dailySheet.bonus.belowMin", { score: l.score, min: l.minScore })}
                  </span>
                  <span className="tabular-nums font-medium">+{money(l.cents / 100)}</span>
                </div>
              ))}
              <div className="flex justify-between gap-2 font-semibold border-t border-border pt-1 mt-1">
                <span>{t("app.dailySheet.bonusTotal")}</span>
                <span className="tabular-nums">+{money(sheet.bonusCents / 100)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{sheet.payRunId ? t("app.dailySheet.onPayRun") : t("app.dailySheet.toPayRun")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PhotoSlot({ label, url, disabled, onPick }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`relative w-12 h-10 rounded border border-border overflow-hidden bg-muted grid place-items-center text-[10px] text-muted-foreground ${disabled ? "" : "cursor-pointer"}`} title={label}>
      {url ? <img src={url} alt={label} className="w-full h-full object-cover" /> : busy ? <Loader2 size={12} className="animate-spin" /> : <span className="inline-flex items-center gap-0.5"><Camera size={10} />{label}</span>}
      {!disabled && (
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              await onPick(f);
            } catch (err) {
              showError(err.message);
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      )}
    </label>
  );
}
