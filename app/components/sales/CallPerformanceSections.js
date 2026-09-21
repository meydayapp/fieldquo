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

/** A rate's number, or the counts standing in for it under the floor. */
function Share({ value, count, belowFloor }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      <span className="text-base font-semibold tabular-nums">{count}</span>
      {value.value !== null ? (
        <span className="text-xs text-muted-foreground"> · {value.value}%</span>
      ) : typeof belowFloor === "function" && value.sampleSize > 0 ? (
        <span className="block text-xs text-muted-foreground">{belowFloor(value.remaining)}</span>
      ) : null}
    </span>
  );
}

/** Red, in words, under a Twilio column when the carrier's data is short for the period. */
function CarrierMissing({ table, labels }) {
  if (!table?.carrierMissingSince) return null;
  return <div className="text-xs text-red-700 dark:text-red-300">{labels.carrierMissingSince(new Date(table.carrierMissingSince).toLocaleDateString(), table.carrierMissingCount)}</div>;
}

/** The four buckets as one bar, so the shape of a rep's dials reads at a glance. */
const BUCKET_ORDER = ["nobodyAnswered", "hungUpFast", "voicemailOrBrief", "realConversation"];
const BUCKET_CLASS = {
  nobodyAnswered: "bg-neutral-400 dark:bg-neutral-600",
  hungUpFast: "bg-amber-400 dark:bg-amber-600",
  voicemailOrBrief: "bg-sky-400 dark:bg-sky-600",
  realConversation: "bg-emerald-500 dark:bg-emerald-500",
};
function BucketBar({ table, labels }) {
  if (!table || table.joined === 0) return null;
  return (
    <div className="mt-1 flex h-2.5 w-full min-w-[140px] overflow-hidden rounded-full bg-muted" role="img" aria-label={BUCKET_ORDER.map((k) => `${labels[k]}: ${table.buckets[k]}`).join(", ")}>
      {BUCKET_ORDER.map((k) =>
        table.buckets[k] > 0 ? <div key={k} className={BUCKET_CLASS[k]} style={{ width: `${(table.buckets[k] / table.joined) * 100}%` }} title={`${labels[k]}: ${table.buckets[k]}`} /> : null,
      )}
    </div>
  );
}

/** One header: the plain word, its one-line meaning, and its source. */
function Head({ word, meaning, source }) {
  return (
    <th className={`${TH} align-top`}>
      <div>{word}</div>
      {meaning ? <div className="normal-case font-normal tracking-normal text-[11px] leading-snug text-muted-foreground max-w-[11rem]">{meaning}</div> : null}
      {source ? <div className="normal-case font-normal tracking-normal text-[11px] text-muted-foreground/80 mt-0.5">{source}</div> : null}
    </th>
  );
}

/** The gap between the rep's word and the measured real conversations, in points. Red from ten points of over-marking. */
function Gap({ points, labels }) {
  if (points === null || points === undefined) return <span className="text-muted-foreground">—</span>;
  const cls = points >= 10 ? "text-red-700 dark:text-red-300 font-semibold" : points <= -10 ? "text-emerald-700 dark:text-emerald-300" : "text-foreground";
  return (
    <span className={`tabular-nums ${cls}`}>
      {points > 0 ? "+" : ""}
      {points} {labels.points}
    </span>
  );
}

/**
 * One rep's row of the calls table. `table` is lib/sales/calls/dialTable.js's
 * dialTableRow: one denominator (dials with a prospect leg), attribution by
 * attempt joined to the carrier by the child call sid, every Twilio column
 * blank-and-red rather than borrowed when the carrier's data is missing.
 */
function DialRow({ name, sub, table, labels, href }) {
  const t = table;
  const twilio = (cell) => (t?.carrierMissingSince && t.joined === 0 ? <span className="text-red-700 dark:text-red-300 text-xs">{labels.carrierMissingSince(new Date(t.carrierMissingSince).toLocaleDateString(), t.carrierMissingCount)}</span> : cell);
  const bucketCell = (k) => twilio(<Share value={t?.bucketRates?.[k]} count={t?.buckets[k]} belowFloor={labels.belowFloor} />);
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
        <BucketBar table={t} labels={labels} />
        {t && t.unverified.total > 0 ? <div className="text-xs text-muted-foreground mt-1">{labels.unverified(t.unverified.total, t.unverified.handset)}</div> : null}
      </td>
      <td className={`${TD} tabular-nums`}>
        <span className="text-base font-semibold">{t ? t.dials : "—"}</span>
        <CarrierMissing table={t} labels={labels} />
      </td>
      <td className={TD}>{bucketCell("nobodyAnswered")}</td>
      <td className={TD}>{bucketCell("hungUpFast")}</td>
      <td className={TD}>{bucketCell("voicemailOrBrief")}</td>
      <td className={TD}>
        {bucketCell("realConversation")}
        {t && t.joined > 0 ? <div className="text-xs text-muted-foreground">{labels.conversationBasis(t.conversationFromTranscript, t.conversationFromClock)}</div> : null}
      </td>
      <td className={TD}>
        <Share value={t?.reached} count={t?.reached?.hit} belowFloor={labels.belowFloor} />
        {t && t.dials > 0 && t.logged < t.dials ? <div className="text-xs text-muted-foreground">{labels.notLogged(t.dials - t.logged)}</div> : null}
      </td>
      <td className={`${TD} tabular-nums`}>{t ? t.callbacksPromised : "—"}</td>
      <td className={`${TD} tabular-nums`}>
        {twilio(
          <span>
            {t ? t.minutesTalking : "—"}
            {t && t.answeredCalls > 0 ? <span className="block text-xs text-muted-foreground">{labels.overAnswered(t.answeredCalls)}</span> : null}
          </span>,
        )}
      </td>
      <td className={TD}>
        <Gap points={t?.gap} labels={labels} />
      </td>
    </tr>
  );
}

/** "Twilio: N prospect legs · FieldQuo: N attempts · N unjoined" — red when they differ. */
function Reconciliation({ calls, labels }) {
  const r = calls.reconciliation;
  if (!r) {
    return <p className="text-sm text-amber-800 dark:text-amber-200">{labels.carrierNotAsked(calls.carrierError || "")}</p>;
  }
  const cls = r.differ ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300";
  return (
    <p className={`text-sm font-medium ${cls}`} data-performance-reconciliation>
      {labels.reconciliation(r.twilioLegs, r.attempts, r.unjoinedAttempts + r.unjoinedLegs)}
      {r.unjoinedAttempts || r.unjoinedLegs ? <span className="block text-xs font-normal">{labels.reconciliationDetail(r.unjoinedAttempts, r.unjoinedLegs)}</span> : null}
      {!r.listedAll ? <span className="block text-xs font-normal">{labels.carrierListCapped}</span> : null}
    </p>
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
        <Reconciliation calls={calls} labels={labels} />
        <div className={`${CARD} p-0 overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="bg-muted">
                <tr>
                  <Head word={labels.rep} />
                  <Head word={labels.dials} meaning={labels.dialsMeaning} source={labels.sourceTwilio} />
                  <Head word={labels.nobodyAnswered} meaning={labels.nobodyAnsweredMeaning} source={labels.sourceTwilio} />
                  <Head word={labels.hungUpFast} meaning={labels.hungUpFastMeaning} source={labels.sourceTwilio} />
                  <Head word={labels.voicemailOrBrief} meaning={labels.voicemailOrBriefMeaning} source={labels.sourceTwilio} />
                  <Head word={labels.realConversation} meaning={labels.realConversationMeaning} source={labels.sourceTranscriptOrTwilio} />
                  <Head word={labels.reachedRepsWord} meaning={labels.reachedRepsWordMeaning} source={labels.sourceRep} />
                  <Head word={labels.callbacks} meaning={labels.callbacksMeaning} source={labels.sourceRep} />
                  <Head word={labels.minutesTalking} meaning={labels.minutesTalkingMeaning} source={labels.sourceTwilio} />
                  <Head word={labels.gapHeading} meaning={labels.gapMeaning} source={labels.sourceDerived} />
                </tr>
              </thead>
              <tbody>
                {calls.reps.length === 0 ? (
                  <tr>
                    <td className={TD} colSpan={10}>
                      {labels.noCalls}
                    </td>
                  </tr>
                ) : (
                  calls.reps.map((r) => (
                    <DialRow key={r.id} name={r.name} sub={r.agency?.name || null} table={r.table} labels={labels} href={repHref(r.id)} />
                  ))
                )}
                {calls.agencies.map((a) => (
                  <DialRow key={`agency:${a.id}`} name={a.name} sub={labels.agencyOf(a.reps)} table={a.table} labels={labels} />
                ))}
                {calls.reps.length > 0 ? <DialRow name={labels.everyone} table={calls.totalTable} labels={labels} /> : null}
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
