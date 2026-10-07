"use client";

// app/components/planRead/FirstPassCards.js
//
// The first pass on the drawing-read screen (lib/planRead/firstPass.js,
// takeoff.js, slices.js): what was measured and how sure, what the read
// PRICED ON with a one-tap change, the crew plan with 2/3/4-painter options,
// and — when one set holds several quotes — a card per part with its own
// "Create quote". Every figure arrives computed by the server
// (lib/planRead/view.js); nothing here does arithmetic on money. Every
// control changes the read through PATCH /api/plan-reads/[id] and the screen
// reloads from the server's answer.

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Ruler, Users, ListChecks, Layers } from "lucide-react";

const card = "bg-card border border-border rounded-xl p-4 sm:p-5";

function Badge({ tone = "neutral", children }) {
  const tones = {
    neutral: "bg-muted text-muted-foreground",
    warn: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    good: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

export function ConfidenceChip({ value, t }) {
  if (value === "high") return <Badge tone="good">{t("app.planRead.confidence.high", "High")}</Badge>;
  if (value === "medium") return <Badge>{t("app.planRead.confidence.medium", "Medium")}</Badge>;
  if (value === "none") return <Badge tone="warn">{t("app.planRead.source.none", "No quantity")}</Badge>;
  return <Badge tone="warn">{t("app.planRead.confidence.low", "Low · verify")}</Badge>;
}

/** Surfaces the read could not measure — never silently at 0. */
export function UnmeasuredBanner({ view, t }) {
  const list = view.firstPass?.unmeasured || [];
  if (!list.length) return null;
  return (
    <div className="mt-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm" role="status">
      <p className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="w-4 h-4" aria-hidden />
        {t("app.planRead.firstPass.unmeasuredTitle", "{n} surfaces have no quantity and are not priced", { n: list.length })}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{t("app.planRead.firstPass.unmeasuredBody", "Measure them on the sheet, or tell the chat their size.")}</p>
      <ul className="mt-1 list-disc pl-4 text-xs">
        {list.map((u) => (
          <li key={u.id}>{u.areaName ? `${u.areaName} — ${u.label}` : u.label}</li>
        ))}
      </ul>
    </div>
  );
}

/** What the measurement pass found on the sheets, with how sure each is. */
export function MeasuredCard({ view, t }) {
  const [open, setOpen] = useState(false);
  const fp = view.firstPass;
  if (!fp) return null;
  const faces = fp.faces || [];
  const heights = fp.heights || [];
  if (!faces.length && !heights.length) {
    return fp.measureMissing ? null : (
      <section className={card}>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Ruler className="w-4 h-4" aria-hidden />{t("app.planRead.firstPass.measuredTitle", "Measured on the drawings")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("app.planRead.firstPass.measuredNone", "Nothing could be measured on these sheets — no scale or printed sizes were found. The quantities come from the other sources shown.")}</p>
      </section>
    );
  }
  const measured = faces.filter((f) => f.measured);
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Ruler className="w-4 h-4" aria-hidden />{t("app.planRead.firstPass.measuredTitle", "Measured on the drawings")}</h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs underline min-h-[32px]">
          {open ? t("app.planRead.firstPass.hide", "Hide") : t("app.planRead.firstPass.showAll", "Show all {n}", { n: faces.length + heights.length })}
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {t("app.planRead.firstPass.measuredSummary", "{faces} faces and rooms measured, {heights} heights — printed sizes first, the rest scaled from the sheet at its printed scale. Check the ones marked low.", { faces: measured.length, heights: heights.filter((h) => h.heightFt).length })}
      </p>
      {open && (
        <ul className="mt-2 space-y-2 text-sm">
          {faces.map((f) => (
            <li key={f.id} className="rounded-lg border border-border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{f.name}</span>
                <span className="text-xs text-muted-foreground">{f.sheet}{f.view ? ` · ${f.view}` : ""}</span>
                <ConfidenceChip value={f.confidence} t={t} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{f.sentence}</p>
              {f.sameAs && <p className="text-[11px] mt-0.5">{t("app.planRead.firstPass.sameAs", "The same {what} as on {where} — counted once, from there", { what: f.room ? t("app.planRead.firstPass.room", "room") : t("app.planRead.firstPass.wall", "wall"), where: f.sameAs })}</p>}
              {f.alsoOn?.length > 0 && <p className="text-[11px] mt-0.5">{t("app.planRead.firstPass.alsoOn", "Also drawn on {where} — counted once, from this drawing", { where: f.alsoOn.join(", ") })}</p>}
              {f.stateOut && <p className="text-[11px] mt-0.5 text-amber-800 dark:text-amber-300">{t("app.planRead.firstPass.stateOut", "Only on the proposed drawings — not in the existing layout this price is for")}</p>}
              {f.check && <p className="text-[11px] mt-0.5">{t("app.planRead.firstPass.check", "Check: {what}", { what: f.check })}</p>}
            </li>
          ))}
          {heights.map((h) => (
            <li key={h.id} className="rounded-lg border border-dashed border-border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{h.label}</span>
                <ConfidenceChip value={h.confidence} t={t} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{h.sentence}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "Priced on these assumptions" — one tap changes one and re-prices. */
export function AssumptionsCard({ view, t, disabled, onOp }) {
  const list = view.firstPass?.assumed || [];
  if (!list.length || !list.some((a) => a.value)) return null;
  return (
    <section className={card}>
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><ListChecks className="w-4 h-4" aria-hidden />{t("app.planRead.assumed.title", "Priced on these assumptions")}</h2>
      <p className="text-xs text-muted-foreground mt-1">{t("app.planRead.assumed.note", "Change one and the price is worked out again at once — no AI call, no charge.")}</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {list.map((a) => (
          <li key={a.key} className="rounded-lg border border-border p-3">
            <label className="block text-xs font-semibold" htmlFor={`assumed-${a.key}`}>{t(`app.planRead.assumed.key.${a.key}`, a.label)}</label>
            <select
              id={`assumed-${a.key}`}
              value={a.value || ""}
              disabled={disabled}
              onChange={(e) => onOp({ op: "set_assumption", key: a.key, value: e.target.value })}
              className="mt-1 w-full min-h-[40px] rounded-md border border-border bg-background px-2 text-sm"
            >
              {!a.value && <option value="">{t("app.planRead.assumed.notStated", "Not stated")}</option>}
              {a.options.map((o) => (
                <option key={o} value={o}>{t(`app.planRead.assumed.option.${o}`, o.replace(/_/g, " "))}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {a.source === "person" ? t("app.planRead.assumed.byYou", "Set by your team") : a.basis || t("app.planRead.assumed.byAi", "FieldQuo AI's assumption")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The crew plan: painters, productive hours, days on site, 2/3/4 options. */
export function CrewPlanCard({ view, t, money, disabled, onOp }) {
  const plan = view.draft?.plan;
  const [size, setSize] = useState(plan?.crew?.size ?? "");
  const [hours, setHours] = useState(plan?.crew?.hoursPerDay ?? "");
  if (!plan) return null;
  const labour = view.pricing?.plan?.options || null;
  const dirty = Number(size) !== plan.crew.size || Number(hours) !== plan.crew.hoursPerDay;
  return (
    <section className={card}>
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Users className="w-4 h-4" aria-hidden />{t("app.planRead.crew.title", "Crew plan")}</h2>
      <p className="text-sm mt-1">
        {t("app.planRead.crew.summary", "{hours} h on site — {days} days for {size} painters at {hpd} productive hours a day.", { hours: plan.hours, days: plan.days, size: plan.crew.size, hpd: plan.crew.hoursPerDay })}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5">
        {t("app.planRead.crew.why", "Crew: {size}. Day: {hpd}.", { size: plan.crew.sizeWhy, hpd: plan.crew.hoursWhy })}
        {plan.crew.setupWhy ? ` ${plan.crew.setupWhy}` : ""}
        {plan.crew.outOfHours ? ` ${t("app.planRead.crew.outOfHours", "Out-of-hours work: any premium you pay the crew is not in this price — add it.")}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs">
          {t("app.planRead.crew.size", "Painters")}
          <input type="number" min="1" max="50" step="1" value={size} disabled={disabled} onChange={(e) => setSize(e.target.value)} className="mt-1 block w-20 min-h-[40px] rounded-md border border-border bg-background px-2 text-right" />
        </label>
        <label className="text-xs">
          {t("app.planRead.crew.hoursPerDay", "Productive hours a day")}
          <input type="number" min="1" max="24" step="0.25" value={hours} disabled={disabled} onChange={(e) => setHours(e.target.value)} className="mt-1 block w-24 min-h-[40px] rounded-md border border-border bg-background px-2 text-right" />
        </label>
        {dirty && (
          <button type="button" disabled={disabled} onClick={() => onOp({ op: "set_crew", crewSize: size === "" ? null : Number(size), hoursPerDay: hours === "" ? null : Number(hours) })} className="min-h-[40px] px-3 rounded-lg border border-border text-sm hover:bg-accent">
            {t("app.planRead.save", "Save")}
          </button>
        )}
      </div>
      <div className="overflow-x-auto -mx-4 sm:mx-0 mt-3">
        <table className="w-full text-sm min-w-[420px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-2 px-4 sm:px-2 font-medium">{t("app.planRead.crew.option", "Crew")}</th>
              <th className="py-2 px-2 font-medium text-right">{t("app.planRead.crew.days", "Days on site")}</th>
              {view.canSeeMoney && <th className="py-2 px-2 font-medium text-right">{t("app.planRead.crew.labour", "Labour cost")}</th>}
              {view.canSeeMoney && <th className="py-2 px-2 font-medium text-right">{t("app.planRead.crew.equipment", "Equipment")}</th>}
            </tr>
          </thead>
          <tbody>
            {plan.options.map((o, i) => (
              <tr key={o.crew} className={`border-b border-border/60 ${o.current ? "font-semibold" : ""}`}>
                <td className="py-1.5 px-4 sm:px-2">{t("app.planRead.crew.painters", "{n} painters", { n: o.crew })}{o.current ? ` · ${t("app.planRead.crew.current", "this plan")}` : ""}</td>
                <td className="py-1.5 px-2 text-right">{`${o.days} (${o.wholeDays})`}</td>
                {view.canSeeMoney && <td className="py-1.5 px-2 text-right">{labour?.[i] ? money(labour[i].labourCost) : "—"}</td>}
                {view.canSeeMoney && <td className="py-1.5 px-2 text-right">{money(o.equipmentCost)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">{t("app.planRead.crew.optionsNote", "The hours are the same whatever the crew; the days, and so the equipment rental, are not. Days in brackets are whole days on site.")}</p>
      {plan.deliveryNote && <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1">{plan.deliveryNote}</p>}
    </section>
  );
}

/** Past jobs of the same trade: the range, where this sits, and why if far. */
export function PastJobsLine({ compare, t, money }) {
  if (!compare) return <p className="text-xs text-muted-foreground">{t("app.planRead.past.none", "No won or completed jobs of this trade with a measured area to compare yet.")}</p>;
  const pos = { below: t("app.planRead.past.below", "below"), within: t("app.planRead.past.within", "inside"), above: t("app.planRead.past.above", "above") }[compare.position];
  return (
    <div className="text-xs">
      <p>
        {t("app.planRead.past.range", "Your {n} {kind} jobs: {low}–{high} per sq ft — this one is {pos} that range.", {
          n: compare.count,
          kind: compare.sameType ? t("app.planRead.past.sameType", "similar") : t("app.planRead.past.anyType", "won"),
          low: money(compare.range.low),
          high: money(compare.range.high),
          pos,
        })}
      </p>
      {compare.hours && (
        <p className="text-muted-foreground">
          {t("app.planRead.past.hours", "Hours per sq ft: {low}–{high}{actual} — this one is {pos}.", {
            low: compare.hours.low,
            high: compare.hours.high,
            actual: compare.hours.actual ? ` (${t("app.planRead.past.actual", "incl. hours clocked on finished jobs")})` : "",
            pos: { below: t("app.planRead.past.below", "below"), within: t("app.planRead.past.within", "inside"), above: t("app.planRead.past.above", "above") }[compare.hours.position],
          })}
        </p>
      )}
      {compare.flagged && (
        <p className="text-amber-800 dark:text-amber-300 mt-0.5 flex items-start gap-1">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
          {t("app.planRead.past.gap", "{pct}% outside your range. Likely why: {reasons}.", { pct: Math.abs(compare.gapPct), reasons: compare.reasons.join("; ") })}
        </p>
      )}
    </div>
  );
}

/** One drawing set → several quotes: a card per part, each with its own Create quote. */
export function SlicesCard({ view, t, money, onCreate }) {
  const slices = view.firstPass?.slices || [];
  if (slices.length < 2) return null;
  return (
    <section className={card}>
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Layers className="w-4 h-4" aria-hidden />{t("app.planRead.slices.title", "This set makes {n} quotes", { n: slices.length })}</h2>
      <p className="text-xs text-muted-foreground mt-1">{t("app.planRead.slices.note", "Each part is drafted on its own — its own areas, access, crew plan and price. No second read is needed.")}</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {slices.map((sl) => (
          <li key={sl.key} className="rounded-lg border border-border p-3 flex flex-col gap-1">
            <p className="font-semibold text-sm">{sl.label}</p>
            <p className="text-xs text-muted-foreground">
              {[
                sl.sqft ? t("app.planRead.slices.sqft", "{n} sq ft", { n: Number(sl.sqft).toLocaleString() }) : null,
                sl.hours ? t("app.planRead.slices.hours", "{n} h", { n: sl.hours }) : null,
                sl.days ? t("app.planRead.slices.days", "{n} days", { n: sl.days }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {sl.unmeasured > 0 && <p className="text-xs text-amber-800 dark:text-amber-300">{t("app.planRead.slices.unmeasured", "{n} surfaces not measured", { n: sl.unmeasured })}</p>}
            {sl.guessed?.mostly && <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{t("app.planRead.slices.guessed", "Mostly estimated, not measured — {pct}% of this price", { pct: Math.round(sl.guessed.share * 100) })}</p>}
            {view.canSeeMoney && sl.recommended !== undefined && sl.recommended !== null && (
              <p className="text-sm">
                {t("app.planRead.slices.recommended", "Recommended {v} at your {pct}% target", { v: money(sl.recommended), pct: sl.targetPct })}
                {sl.meetsTarget ? <CheckCircle2 className="inline w-4 h-4 ml-1 text-emerald-600" aria-label={t("app.planRead.slices.meets", "your rates hold the target")} /> : null}
              </p>
            )}
            {view.canSeeMoney && sl.kind === "painting" && <PastJobsLine compare={sl.compare} t={t} money={money} />}
            <button type="button" onClick={() => onCreate(sl.key)} className="mt-2 self-start min-h-[44px] px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
              {t("app.planRead.slices.create", "Create the {label} quote", { label: sl.label.toLowerCase() })}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Access line source, in words. */
export function AccessSource({ a, t }) {
  if (a.priceSource === "reference") return <Badge tone="warn">{t("app.planRead.access.reference", "Estimated from reference · confirm")}</Badge>;
  if (a.priceSource === "company") return <Badge>{t("app.planRead.access.company", "Your rental rate · confirm")}</Badge>;
  if (a.priceSource === "ai") return <Badge tone="warn">{t("app.planRead.draft.aiEntered", "Entered by FieldQuo AI · verify")}</Badge>;
  if (a.priceSource === "person") return <Badge tone="good">{a.confirmed ? t("app.planRead.access.confirmed", "Confirmed") : t("app.planRead.access.yours", "Your price")}</Badge>;
  return <Badge tone="warn">{t("app.planRead.access.unpriced", "No price")}</Badge>;
}
