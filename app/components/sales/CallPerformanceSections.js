"use client";

// app/components/sales/CallPerformanceSections.js
//
// The two sections a performance page draws about calls — the calling
// figures and the call-quality scorecards — for BOTH pages that draw them:
// /platform/sales/performance (English, FieldQuo's own staff) and
// /sales/agency/performance (nine languages, the agency's team).
//
// One component, so the two pages cannot disagree about what a column
// means. Every word comes in through `labels`, because the platform console
// is English-only by convention (app/i18n/appMessages.js's own note) while
// the portal is held to the rep's language by scripts/check-sales-portal-
// i18n.mjs — the agency page builds `labels` from t(), the platform page
// from literals, and this file carries no prose of its own.
//
// It never divides two numbers. A rate arrives from lib/sales/performance.js
// rate() with `value` null under the floor, and this prints "3 of 4" then —
// the same honesty rule the platform page keeps for conversion.
import Link from "next/link";

const CARD = "rounded-xl border border-border bg-card p-4";
const TH = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const TD = "px-3 py-3 text-sm text-foreground align-top";

/** A rate, or the counts standing in for it. `belowFloor(remaining)` is the hint's wording. */
function Rate({ value, belowFloor }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  if (value.value !== null) {
    return (
      <span>
        {value.value}% <span className="text-xs text-muted-foreground">({value.hit}/{value.sampleSize})</span>
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      {value.hit}/{value.sampleSize}
      {typeof belowFloor === "function" && value.sampleSize > 0 ? <span className="block text-xs">{belowFloor(value.remaining)}</span> : null}
    </span>
  );
}

function Trend({ value, labels }) {
  if (value === null || value === undefined) return <span className="text-xs text-muted-foreground">{labels.noTrend}</span>;
  const cls = value > 0 ? "text-emerald-700 dark:text-emerald-300" : value < 0 ? "text-red-700 dark:text-red-300" : "text-muted-foreground";
  return (
    <span className={`text-xs ${cls}`}>
      {value > 0 ? "+" : ""}
      {value} {labels.vsPrevious}
    </span>
  );
}

function minutes(ms) {
  if (!Number.isFinite(ms) || ms === null) return null;
  return Math.round(ms / 60000);
}

function CallRow({ name, sub, stats, labels, href }) {
  const m = stats?.measured;
  return (
    <tr className="border-t border-border">
      <td className={TD}>
        {href ? (
          <Link href={href} className="font-medium text-foreground underline">
            {name}
          </Link>
        ) : (
          <div className="font-medium text-foreground">{name}</div>
        )}
        {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
      </td>
      <td className={`${TD} tabular-nums`}>{stats?.dials ?? "—"}</td>
      <td className={`${TD} tabular-nums`}>
        {m ? m.connected : "—"}
        {m ? <div className="text-xs text-muted-foreground">{labels.ofBridged(m.bridged)}</div> : null}
      </td>
      <td className={`${TD} tabular-nums`}>
        {m && m.talkMs !== null ? minutes(m.talkMs) : "—"}
        {m && m.talkMs !== null ? <div className="text-xs text-muted-foreground">{labels.overCalls(m.measuredOf)}</div> : null}
      </td>
      <td className={TD}>
        <Rate value={m?.carrierAnswerRate} belowFloor={labels.belowFloor} />
      </td>
      <td className={TD}>
        <Rate value={stats?.reportedReachRate} belowFloor={labels.belowFloor} />
      </td>
      <td className={`${TD} tabular-nums`}>{stats?.callbacks?.booked ?? "—"}</td>
    </tr>
  );
}

function QualityRow({ name, sub, row, labels, href }) {
  return (
    <tr className="border-t border-border">
      <td className={TD}>
        {href ? (
          <Link href={href} className="font-medium text-foreground underline">
            {name}
          </Link>
        ) : (
          <div className="font-medium text-foreground">{name}</div>
        )}
        {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
      </td>
      <td className={`${TD} tabular-nums`}>
        {row.averageOverall === null ? <span className="text-muted-foreground">—</span> : <span className="text-lg font-semibold">{row.averageOverall}</span>}
        <div>
          <Trend value={row.trend} labels={labels} />
        </div>
      </td>
      <td className={`${TD} tabular-nums`}>
        {/* Three numbers, never one. "Scored 4 · recorded 40 · not yet 36"
            is a different fact from "average 71", and the reader gets both. */}
        <div>
          {labels.scored}: {row.scored}
        </div>
        <div>
          {labels.recorded}: {row.recorded}
        </div>
        <div>
          {labels.notYetScored}: {row.notYetScored}
        </div>
        {row.unscorable > 0 ? (
          <div className="text-xs text-muted-foreground">
            {labels.unscorable}: {row.unscorable}
          </div>
        ) : null}
        {row.failed > 0 ? (
          <div className="text-xs text-red-700 dark:text-red-300">
            {labels.failed}: {row.failed}
          </div>
        ) : null}
        {row.reviewed > 0 ? (
          <div className="text-xs text-muted-foreground">
            {labels.reviewed}: {row.reviewed}
          </div>
        ) : null}
      </td>
      <td className={TD}>
        <Rate value={row.disclosureSaid} belowFloor={labels.belowFloor} />
      </td>
      <td className={TD}>
        <Rate value={row.permissionAsked} belowFloor={labels.belowFloor} />
      </td>
      <td className={TD}>
        <Rate value={row.bannedMoveRate} belowFloor={labels.belowFloor} />
      </td>
      <td className={`${TD} tabular-nums`}>{row.meanTalkRatio === null ? "—" : `${Math.round(row.meanTalkRatio * 100)}%`}</td>
    </tr>
  );
}

/**
 * @param {{ calls: object, callQuality: object, labels: object,
 *           repHref?: (id) => string|null, qualityHref?: (repId) => string|null }} props
 */
export default function CallPerformanceSections({ calls, callQuality, labels, repHref = () => null, qualityHref = () => null }) {
  if (!calls || !callQuality) return null;
  return (
    <>
      <section className="space-y-2" data-performance-calls>
        <h2 className="text-base font-semibold text-foreground">{labels.callsHeading}</h2>
        <p className="text-sm text-muted-foreground">{labels.callsIntro}</p>
        <div className={`${CARD} p-0 overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className={TH}>{labels.rep}</th>
                  <th className={TH}>{labels.dials}</th>
                  <th className={TH}>{labels.connected}</th>
                  <th className={TH}>{labels.talkMinutes}</th>
                  <th className={TH}>{labels.answerRate}</th>
                  <th className={TH}>{labels.reachRate}</th>
                  <th className={TH}>{labels.callbacks}</th>
                </tr>
              </thead>
              <tbody>
                {calls.reps.length === 0 ? (
                  <tr>
                    <td className={TD} colSpan={7}>
                      {labels.noCalls}
                    </td>
                  </tr>
                ) : (
                  calls.reps.map((r) => (
                    <CallRow key={r.id} name={r.name} sub={r.agency?.name || null} stats={r.stats} labels={labels} href={repHref(r.id)} />
                  ))
                )}
                {calls.agencies.map((a) => (
                  <CallRow key={`agency:${a.id}`} name={a.name} sub={labels.agencyOf(a.reps)} stats={a.stats} labels={labels} />
                ))}
                {calls.reps.length > 0 ? <CallRow name={labels.everyone} stats={calls.total} labels={labels} /> : null}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{labels.callsNote}</p>
      </section>

      <section className="space-y-2" data-performance-quality>
        <h2 className="text-base font-semibold text-foreground">{labels.qualityHeading}</h2>
        <p className="text-sm text-muted-foreground">{labels.qualityIntro}</p>
        <div className={`${CARD} p-0 overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className={TH}>{labels.rep}</th>
                  <th className={TH}>{labels.averageOverall}</th>
                  <th className={TH}>{labels.counts}</th>
                  <th className={TH}>{labels.disclosureSaid}</th>
                  <th className={TH}>{labels.permissionAsked}</th>
                  <th className={TH}>{labels.bannedMoveRate}</th>
                  <th className={TH}>{labels.talkRatio}</th>
                </tr>
              </thead>
              <tbody>
                {callQuality.reps.length === 0 ? (
                  <tr>
                    <td className={TD} colSpan={7}>
                      {labels.noCalls}
                    </td>
                  </tr>
                ) : (
                  callQuality.reps.map((r) => (
                    <QualityRow key={r.id} name={r.name} sub={r.agency?.name || null} row={r} labels={labels} href={qualityHref(r.id)} />
                  ))
                )}
                {callQuality.agencies.map((a) => (
                  <QualityRow key={`agency:${a.id}`} name={a.name} sub={labels.agencyOf(a.reps)} row={a} labels={labels} />
                ))}
                {callQuality.reps.length > 0 ? <QualityRow name={labels.everyone} row={callQuality.total} labels={labels} href={qualityHref(null)} /> : null}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{labels.qualityNote}</p>
      </section>
    </>
  );
}
