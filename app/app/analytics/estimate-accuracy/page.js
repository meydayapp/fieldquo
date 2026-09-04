// app/(app)/analytics/estimate-accuracy/page.js
//
// Where your estimates and your outcomes diverge, across finished jobs.
//
// ── Three rules this screen exists to keep ─────────────────────────────────
//
// 1. A percentage never appears below the sample floor. The API returns null
//    for every rate on a thin sample and `reportable: false` beside it, and
//    `Rate` below is the ONLY place that decides how a null renders — so a new
//    figure cannot accidentally print "0%" for "we don't know". That is the
//    whole point of the shape; a second renderer would be the copy that rots.
//
// 2. The MEDIAN is the headline and it is labelled as such. The mean sits
//    beside it in smaller type with the word "average" on it, and when the two
//    disagree the API names the job responsible and this screen prints that
//    sentence. A reader who cannot tell which of the two they are holding will
//    price against whichever is worse.
//
// 3. Every excluded job is reachable. A report that quietly drops nine of
//    fourteen jobs and shows a confident percentage over the other five is the
//    same failure as a dead button: it looks like it worked. The exclusions are
//    one click away on every card, with the reason spelled out.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  Lightbulb,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatAppMoney } from "@/lib/format/money";
import { useTranslation } from "@/app/hooks/useTranslation";

// ── Periods ────────────────────────────────────────────────────────────────
//
// Built in UTC to match the server, which decides range membership on UTC
// calendar days. Building "this year" from the browser's local clock would put
// a job on the wrong side of a boundary for anyone west of Greenwich.
//
// The windows here are deliberately LONGER than the ones on the financial
// statements screen, which offers "this month" first. This report needs five
// comparable finished jobs before it will print a percentage, and a one-van
// contractor does not finish five costed jobs in a month — so a month preset
// would make the default view of this page a thinness notice, which trains
// people to close it. The shortest preset is a quarter.
const iso = (d) => d.toISOString().slice(0, 10);
const utc = (y, m, day) => new Date(Date.UTC(y, m, day));

function presetRange(key, now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  switch (key) {
    case "thisQuarter": {
      const q = Math.floor(m / 3) * 3;
      return { from: iso(utc(y, q, 1)), to: iso(utc(y, q + 3, 0)) };
    }
    case "last6Months":
      return { from: iso(utc(y, m - 5, 1)), to: iso(utc(y, m, d)) };
    case "yearToDate":
      return { from: iso(utc(y, 0, 1)), to: iso(utc(y, m, d)) };
    case "last12Months":
      return { from: iso(utc(y, m - 11, 1)), to: iso(utc(y, m, d)) };
    case "lastYear":
      return { from: iso(utc(y - 1, 0, 1)), to: iso(utc(y - 1, 11, 31)) };
    default:
      return { from: iso(utc(y, m - 11, 1)), to: iso(utc(y, m, d)) };
  }
}

const PRESETS = [
  ["thisQuarter", "This quarter"],
  ["last6Months", "Last 6 months"],
  ["yearToDate", "Year to date"],
  ["last12Months", "Last 12 months"],
  ["lastYear", "Last year"],
];

const SEVERITY = {
  critical: { Icon: AlertTriangle, cls: "text-red-600 dark:text-red-400" },
  warning: { Icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400" },
  insight: { Icon: Lightbulb, cls: "text-foreground" },
  info: { Icon: Info, cls: "text-muted-foreground" },
};

const TONE = {
  over: { Icon: TrendingUp, cls: "text-red-600 dark:text-red-400" },
  under: { Icon: TrendingDown, cls: "text-emerald-600 dark:text-emerald-400" },
  on_target: { Icon: Minus, cls: "text-muted-foreground" },
};

/**
 * The single renderer for a percentage that may not exist.
 *
 * Null is a stated absence, never a zero — see rule 1 in the header. Nothing
 * else on this page formats a percentage.
 */
function Rate({ value, absent }) {
  if (value == null) {
    return <span className="text-muted-foreground font-normal">{absent}</span>;
  }
  return (
    <span>
      {value > 0 ? "+" : ""}
      {value}%
    </span>
  );
}

export default function EstimateAccuracyPage() {
  const { t, language } = useTranslation();
  const [preset, setPreset] = useState("last12Months");
  const [range, setRange] = useState(() => presetRange("last12Months"));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchJson(
        `/api/analytics/estimate-accuracy?from=${range.from}&to=${range.to}`,
      );
      setData(res);
    } catch (err) {
      // fetchJson always carries a readable message. There is deliberately no
      // silent `if (res.ok)` branch here — AGENTS.md failure class 2.
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  const currency = data?.currency || null;
  const money = useMemo(
    () => (amount) => formatAppMoney(amount, currency, language),
    [currency, language],
  );

  const choosePreset = (key) => {
    setPreset(key);
    setRange(presetRange(key));
  };

  const dimensions = data?.dimensions || {};
  const ordered = ["labourHours", "labourCost", "materials"]
    .map((k) => dimensions[k])
    .filter(Boolean);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg md:text-xl font-semibold">
          {t("app.estimateAccuracy.title", "Estimate accuracy")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.estimateAccuracy.subtitle",
            "What your finished jobs were estimated to cost, against what they actually cost — labour and materials kept apart, because they go wrong for different reasons.",
          )}
        </p>
        <Link
          href="/app/analytics/benchmark"
          className="inline-flex items-center gap-1.5 text-sm text-foreground underline mt-2"
        >
          {t("app.estimateAccuracy.backToInsights", "How you compare")}
        </Link>
      </div>

      {/* ── Range ─────────────────────────────────────────────────────────── */}
      <div className="glass-effect rounded-lg p-4 mb-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => choosePreset(key)}
              className={`text-sm px-3 py-1.5 rounded-lg border ${
                preset === key
                  ? "bg-inverted text-inverted-foreground border-transparent font-semibold"
                  : "border-border text-muted-foreground"
              }`}
            >
              {t(`app.estimateAccuracy.preset.${key}`, label)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">
              {t("app.estimateAccuracy.from", "From")}
            </span>
            <input
              type="date"
              value={range.from}
              onChange={(e) => {
                setPreset("custom");
                setRange((r) => ({ ...r, from: e.target.value }));
              }}
              className="border border-border rounded-lg px-2 py-1.5 bg-transparent"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">
              {t("app.estimateAccuracy.to", "To")}
            </span>
            <input
              type="date"
              value={range.to}
              onChange={(e) => {
                setPreset("custom");
                setRange((r) => ({ ...r, to: e.target.value }));
              }}
              className="border border-border rounded-lg px-2 py-1.5 bg-transparent"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 mb-6 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 bg-accent rounded" />
          <div className="h-32 bg-accent rounded-lg" />
          <div className="h-32 bg-accent rounded-lg" />
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* The counted population, before anything is claimed about it. */}
          <div className="glass-effect rounded-lg p-4 mb-4 text-sm flex gap-2">
            <Info size={16} className="shrink-0 mt-0.5 text-muted-foreground" />
            <div>
              <p>
                {t(
                  "app.estimateAccuracy.scope",
                  "Jobs marked completed between {from} and {to}: {jobs}. Of those, {comparable} had both a saved cost estimate and enough recorded to compare against.",
                  {
                    from: data.range.from,
                    to: data.range.to,
                    jobs: data.jobsInRange,
                    comparable: data.comparableJobs,
                  },
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t(
                  "app.estimateAccuracy.floorNote",
                  "A percentage is only shown where at least {floor} jobs support it. Below that, this page says so instead of printing a number.",
                  { floor: data.minSample },
                )}
              </p>
            </div>
          </div>

          {data.empty ? (
            <div className="glass-effect rounded-lg p-6 text-sm">
              {data.emptyStatement}
            </div>
          ) : (
            <div className="space-y-4">
              {data.findings?.length > 0 && (
                <div className="glass-effect rounded-lg p-4">
                  <h2 className="text-sm font-semibold mb-3">
                    {t("app.estimateAccuracy.findings", "What the numbers say")}
                  </h2>
                  <ul className="space-y-3">
                    {data.findings.map((f, i) => {
                      const { Icon, cls } = SEVERITY[f.severity] || SEVERITY.info;
                      return (
                        <li key={`${f.code}-${i}`} className="flex gap-2 text-sm">
                          <Icon size={16} className={`shrink-0 mt-0.5 ${cls}`} />
                          <span>{f.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {ordered.map((dim) => (
                <DimensionCard
                  key={dim.key}
                  dim={dim}
                  money={money}
                  t={t}
                  segmentAccess={data.segmentAccess || {}}
                />
              ))}

              <DataQuality data={data} t={t} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Hours or money, depending on what the dimension measures.
 *
 * "hrs" was a bare English literal here and in the unrated-workers sentence
 * below — the only two untranslated words on an otherwise fully translated
 * report. app.duration.hours is a countedNoun, so "1 hour" and Ukrainian's
 * three forms come out of Intl.PluralRules rather than out of an `=== 1`.
 */
function amountOf(dim, value, money, t) {
  if (value == null) return "—";
  return dim.unit === "money" ? money(value) : t("app.duration.hours", { value });
}

function DimensionCard({ dim, money, t, segmentAccess }) {
  const [showExclusions, setShowExclusions] = useState(false);
  const tone = TONE[dim.tone] || TONE.on_target;
  const ToneIcon = tone.Icon;

  return (
    <div className="glass-effect rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{dim.label}</h2>
        <span className="text-xs text-muted-foreground shrink-0">
          {t("app.estimateAccuracy.sampleLine", "{n} of {total} jobs comparable", {
            n: dim.sample,
            total: dim.sample + dim.excluded.reduce((s, e) => s + e.count, 0),
          })}
        </span>
      </div>

      {/* ── The headline ─────────────────────────────────────────────────── */}
      {dim.reportable ? (
        <div className="mt-3 flex items-baseline gap-2">
          <ToneIcon size={18} className={`shrink-0 ${tone.cls}`} />
          <span className={`text-2xl font-semibold ${tone.cls}`}>
            <Rate value={dim.medianPct} absent="—" />
          </span>
          <span className="text-sm text-muted-foreground">
            {t("app.estimateAccuracy.typicalJob", "on the typical job")}
          </span>
        </div>
      ) : (
        <p className="mt-3 text-sm">
          {dim.sample === 0
            ? t(
                "app.estimateAccuracy.noneComparable",
                "No job in this period had both sides of this comparison recorded, so there is nothing to report. The exclusions below say which jobs and why.",
              )
            : // The fallback matches the catalogue entry, which was rewritten to
              // drop {plural} — an English `n === 1 ? "" : "s"` wearing a
              // placeholder, which printed a bare Latin "s" in Chinese. The
              // sentence leads with the noun and puts the number after it so no
              // language has to agree with anything.
              t(
                "app.estimateAccuracy.tooThin",
                "Comparable jobs: {n} — fewer than the {floor} this report will draw a percentage from. {more} more and it will.",
                {
                  n: dim.sample,
                  floor: dim.minSample,
                  more: dim.minSample - dim.sample,
                },
              )}
        </p>
      )}

      {/* ── Counts, which survive a thin sample ──────────────────────────── */}
      {dim.sample > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "app.estimateAccuracy.directionLine",
            "{over} over, {under} under, {onTarget} on target.",
            {
              over: dim.direction.over,
              under: dim.direction.under,
              onTarget: dim.direction.onTarget,
            },
          )}
        </p>
      )}

      {/* ── The average and the money, both explicitly labelled ──────────── */}
      {dim.reportable && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t border-border pt-3">
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("app.estimateAccuracy.average", "Average across the jobs")}
            </dt>
            <dd>
              <Rate value={dim.meanPct} absent="—" />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("app.estimateAccuracy.aggregate", "Total, estimated vs actual")}
            </dt>
            <dd>
              {amountOf(dim, dim.aggregate?.estimated, money, t)} →{" "}
              {amountOf(dim, dim.aggregate?.actual, money, t)}{" "}
              <span className="text-muted-foreground">
                (<Rate value={dim.aggregate?.variancePct ?? null} absent="—" />)
              </span>
            </dd>
          </div>
        </dl>
      )}

      {/* ── Segments ─────────────────────────────────────────────────────── */}
      {dim.reportable && (
        <div className="mt-4 space-y-3">
          <SegmentBlock
            title={t("app.estimateAccuracy.byTrade", "By trade")}
            block={dim.segments?.trade}
            dim={dim}
            money={money}
            t={t}
          />
          <SizeBlock block={dim.segments?.size} dim={dim} money={money} t={t} />
          {segmentAccess.client ? (
            <SegmentBlock
              title={t("app.estimateAccuracy.byClient", "By client")}
              block={dim.segments?.client}
              dim={dim}
              money={money}
              t={t}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              {t(
                "app.estimateAccuracy.clientRestricted",
                "By client: your access level doesn't include the client book, so this breakdown is not shown.",
              )}
            </p>
          )}
          {segmentAccess.crew ? (
            <SegmentBlock
              title={t("app.estimateAccuracy.byCrew", "By crew member, on jobs they did alone")}
              block={dim.segments?.crew}
              dim={dim}
              money={money}
              t={t}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              {t(
                "app.estimateAccuracy.crewRestricted",
                "By crew member: your access level doesn't include everyone's hours, so this breakdown is not shown.",
              )}
            </p>
          )}
        </div>
      )}

      {/* ── Exclusions, always reachable ─────────────────────────────────── */}
      {dim.excluded.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowExclusions((v) => !v)}
            className="flex items-center gap-1 text-sm text-muted-foreground"
          >
            {showExclusions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {t(
              "app.estimateAccuracy.excludedToggle",
              "Jobs left out of this comparison: {n}",
              { n: dim.excluded.reduce((s, e) => s + e.count, 0) },
            )}
          </button>
          {showExclusions && (
            <ul className="mt-2 space-y-2 text-sm">
              {dim.excluded.map((ex) => (
                <li key={ex.reason}>
                  <span className="font-medium">
                    {ex.count} — {ex.statement}
                  </span>
                  <ul className="mt-1 ml-4 list-disc text-xs text-muted-foreground">
                    {ex.jobs.map((j) => (
                      <li key={j.jobId}>
                        <Link href={`/app/jobs/${j.jobId}`} className="underline">
                          {j.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SegmentBlock({ title, block, dim, money, t }) {
  if (!block) return null;
  const { reported = [], suppressed = [], unattributed = 0 } = block;
  if (reported.length === 0 && suppressed.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      {reported.length > 0 && (
        <div className="mt-1 overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {reported.map((s) => (
                <tr key={s.key} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-2">{s.label}</td>
                  <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                    <Rate value={s.medianPct} absent="—" />
                  </td>
                  <td className="py-1.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {amountOf(dim, s.aggregate?.estimated, money, t)} →{" "}
                    {amountOf(dim, s.aggregate?.actual, money, t)} · {s.sample}{" "}
                    {t("app.estimateAccuracy.jobsShort", "jobs")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Named and counted, with NO figure. A category the reader knows they
          have must not simply vanish — that reads as a bug, and the honest
          answer is "it exists and it is too thin to speak for". */}
      {suppressed.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("app.estimateAccuracy.tooThinToShow", "Too few jobs to report:")}{" "}
          {suppressed.map((s) => `${s.label} (${s.sample})`).join(", ")}
        </p>
      )}
      {unattributed > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "app.estimateAccuracy.unattributed",
            "Jobs that could not be attributed to a single one of these: {n}. They are counted only in the total above.",
            { n: unattributed },
          )}
        </p>
      )}
    </div>
  );
}

function SizeBlock({ block, dim, money, t }) {
  if (!block) return null;
  if (!block.available) {
    return (
      <p className="text-xs text-muted-foreground">
        {t(
          "app.estimateAccuracy.sizeUnavailable",
          "By job size: needs {needed} comparable jobs to split into thirds; there are {sample}.",
          { needed: block.needed, sample: block.sample },
        )}
      </p>
    );
  }
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {t("app.estimateAccuracy.bySize", "By job size")}
      </h3>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {block.bands.map((b) => (
              <tr key={b.key} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-2">
                  {b.label}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({money(b.from)}–{money(b.to)} estimated)
                  </span>
                </td>
                <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                  <Rate value={b.medianPct} absent="—" />
                </td>
                <td className="py-1.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                  {amountOf(dim, b.aggregate?.estimated, money, t)} →{" "}
                  {amountOf(dim, b.aggregate?.actual, money, t)} · {b.sample}{" "}
                  {t("app.estimateAccuracy.jobsShort", "jobs")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DataQuality({ data, t }) {
  const q = data.dataQuality;
  if (!q) return null;
  const rows = [
    [
      t("app.estimateAccuracy.dq.noEstimate", "Finished jobs with no saved cost estimate"),
      q.jobsWithoutEstimate,
    ],
    [
      t("app.estimateAccuracy.dq.noExpenses", "Finished jobs with no expenses recorded"),
      q.jobsWithoutExpenses,
    ],
    [
      t("app.estimateAccuracy.dq.pending", "Finished jobs with timesheets still awaiting approval"),
      q.jobsWithPendingHours,
    ],
    [
      t("app.estimateAccuracy.dq.unratedHours", "Approved hours worked by someone with no rate on file"),
      q.unratedHours,
    ],
    [
      t("app.estimateAccuracy.dq.mixed", "Jobs covering more than one trade"),
      q.mixedTradeJobs,
    ],
  ];
  return (
    <div className="glass-effect rounded-lg p-4">
      <h2 className="text-sm font-semibold">
        {t("app.estimateAccuracy.dq.title", "What is holding this report back")}
      </h2>
      <p className="text-xs text-muted-foreground mt-1">
        {t(
          "app.estimateAccuracy.dq.subtitle",
          "None of these are estimated around. Each one is a job or an hour this report refused to guess at.",
        )}
      </p>
      <dl className="mt-3 space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium shrink-0">{value}</dd>
          </div>
        ))}
      </dl>
      {q.unratedWorkers.length > 0 && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {t(
            "app.estimateAccuracy.dq.unratedWho",
            "No hourly rate on file: {names}. Their hours cost nothing here, which makes every job they touched look cheaper than it was.",
            {
              names: q.unratedWorkers
                .map((w) => `${w.name} (${t("app.duration.hours", { value: w.hours })})`)
                .join(", "),
            },
          )}
        </p>
      )}
    </div>
  );
}
