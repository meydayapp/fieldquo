"use client";

// app/components/sales/DialBuckets.js
//
// The four measured buckets of lib/sales/calls/dialTable.js, drawn the same
// way wherever they appear: the calls table on both performance pages
// (through CallPerformanceSections) and the rep cards on both floor boards.
//
// One drawing, because the owner's complaint about the floor was that it
// carried a SECOND definition of what a conversation is. The data side of
// that is fixed in reporting.js (repCallStats carries dialTableRow as
// `table`); this file is the screen side — the bar's four colours, the order
// of the buckets and the red carrier-missing rule are decided once, and a
// page that wants them draws this rather than its own.
//
// Every word comes in through `labels` (the platform console is English by
// convention; the portal is held to the rep's language), so this file
// carries no prose. `labels.carrierMissingSince(date, n)` is the red rule's
// sentence; the four bucket names are `labels.nobodyAnswered` etc.

/** The buckets in the order the bar and the counts read, left to right. */
export const BUCKET_ORDER = Object.freeze(["nobodyAnswered", "hungUpFast", "voicemailOrBrief", "realConversation"]);

const BUCKET_CLASS = {
  nobodyAnswered: "bg-neutral-400 dark:bg-neutral-600",
  hungUpFast: "bg-amber-400 dark:bg-amber-600",
  voicemailOrBrief: "bg-sky-400 dark:bg-sky-600",
  realConversation: "bg-emerald-500 dark:bg-emerald-500",
};

/** A rate() with its floor: the percentage, or nothing while it is under it (the count is printed beside it). */
function pct(r) {
  return r && r.value !== null && r.value !== undefined ? `${r.value}%` : null;
}

/** Red, in words, when the carrier's data is short for the period. */
export function CarrierMissing({ table, labels, className = "" }) {
  if (!table?.carrierMissingSince) return null;
  return (
    <div className={`text-xs text-red-700 dark:text-red-300 ${className}`} data-carrier-missing>
      {labels.carrierMissingSince(new Date(table.carrierMissingSince).toLocaleDateString(), table.carrierMissingCount)}
    </div>
  );
}

/** The four buckets as one bar, so the shape of a rep's dials reads at a glance. Nothing when nothing is joined. */
export function BucketBar({ table, labels }) {
  if (!table || table.joined === 0) return null;
  return (
    <div
      className="mt-1 flex h-2.5 w-full min-w-[140px] overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={BUCKET_ORDER.map((k) => `${labels[k]}: ${table.buckets[k]}`).join(", ")}
      data-bucket-bar
    >
      {BUCKET_ORDER.map((k) =>
        table.buckets[k] > 0 ? <div key={k} className={BUCKET_CLASS[k]} style={{ width: `${(table.buckets[k] / table.joined) * 100}%` }} title={`${labels[k]}: ${table.buckets[k]}`} /> : null,
      )}
    </div>
  );
}

/**
 * A floor card's view of the table: the bar, the four counts under it with
 * their names, the real-conversation rate over the one denominator, and the
 * red rule when the carrier's data is missing. Compact — a card, not a
 * table row — and it prints counts first: on a day view most reps are
 * under the percentage floor and the count is the number that is true.
 *
 * @param table   dialTableRow()
 * @param labels  { nobodyAnswered, hungUpFast, voicemailOrBrief, realConversation,
 *                  dialsWithLeg(n), realConversationRate, carrierMissingSince(date, n),
 *                  sourceTwilio, sourceTranscriptOrTwilio }
 */
export default function DialBuckets({ table, labels, compact = false }) {
  if (!table) return null;
  const t = table;
  const missingAll = Boolean(t.carrierMissingSince) && t.joined === 0;
  return (
    <div className="space-y-1" data-dial-buckets>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="opacity-70">{labels.dialsWithLeg(t.dials)}</span>
        <span className="opacity-70">{labels.sourceTwilio}</span>
      </div>
      {missingAll ? (
        <CarrierMissing table={t} labels={labels} />
      ) : (
        <>
          <BucketBar table={t} labels={labels} />
          <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-4"} gap-x-2 gap-y-0.5 text-xs`}>
            {BUCKET_ORDER.map((k) => (
              <div key={k} className="min-w-0">
                <span className={`inline-block h-2 w-2 rounded-full align-middle mr-1 ${BUCKET_CLASS[k]}`} aria-hidden="true" />
                <span className="tabular-nums font-semibold">{t.buckets[k]}</span>
                <span className="opacity-70 break-words"> {labels[k]}</span>
              </div>
            ))}
          </div>
          <CarrierMissing table={t} labels={labels} />
        </>
      )}
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="opacity-70">{labels.realConversationRate}</span>
        <span className="tabular-nums">
          <span className="font-semibold">{t.buckets.realConversation}</span>
          {pct(t.realConversation) ? <span className="opacity-70"> · {pct(t.realConversation)}</span> : null}
          <span className="opacity-70"> {labels.ofDials(t.dials)}</span>
        </span>
      </div>
      <div className="text-[11px] opacity-60 text-right">{labels.sourceTranscriptOrTwilio}</div>
    </div>
  );
}
