// lib/sales/intel/mapsScrapeSentences.js
//
// The sentences the Maps panel prints about a run — pure, so the check can
// execute them and the browser component can import them without dragging
// the database client along (mapsScrapeStatus.js imports @/lib/db).

/** "2026-09-19 23:25 UTC" — the console's own format; no locale, no zone
 *  guess, because two admins in two zones read the same run. */
export function stamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** The sentence one run reads as. */
export function runSentence(r) {
  if (!r) return "";
  return `${r.rows.toLocaleString()} rows · ${r.matched.toLocaleString()} matched a prospect · ${r.unmatched.toLocaleString()} unmatched · written ${stamp(r.firstAt)} → ${stamp(r.lastAt)}`;
}

/**
 * What the run was asked to do, from its own record (--state and what the
 * filter skipped; what it promoted at the end). A run with no record —
 * before 2026-09-21, or a --dry run — says so, and is never printed as
 * "everywhere": absence of a filter record is not a statement that there
 * was no filter.
 */
export function askedSentence(r) {
  const a = r?.asked;
  if (!a) return "State filter not recorded for this run (a run before 2026-09-21, or a dry run).";
  const outside = Number(a.skippedOutside?.rows || 0);
  const where = a.regions?.length
    ? `States: ${a.regions.join(" / ")} only · ${outside.toLocaleString()} prospect${outside === 1 ? "" : "s"} outside skipped (${Number(a.skippedOutside?.claimed || 0).toLocaleString()} held, ${Number(a.skippedOutside?.candidates || 0).toLocaleString()} next in dispatch)`
    : "States: no filter — the whole enrichment order";
  const verify = a.written?.matchedVerify ? ` · ${a.written.matchedVerify} attached on phone/website alone (confirm on the call)` : "";
  const promoted = a.promoted
    ? a.promoted.dry
      ? ` · promotion dry-run: ${a.promoted.promoted} of ${a.promoted.considered} would have become prospects`
      : ` · promoted ${a.promoted.promoted} of ${a.promoted.considered} unmatched into the pool (trade known ${a.promoted.byTrade?.known ?? 0}, to review ${a.promoted.byTrade?.unknown ?? 0}, research queued ${a.promoted.researchQueued ?? 0})`
    : "";
  const stopped = a.stopped ? ` · STOPPED: ${a.stopped.message}` : "";
  return `${where}${verify}${promoted}${stopped}`;
}

/** "promotable now: N · promoted: M" — the two numbers the owner asked the
 *  panel to carry. */
export function promotionSentence(p) {
  if (!p || p.promotable === null || p.promotable === undefined) return "Promotion counts unavailable.";
  return `promotable now: ${Number(p.promotable).toLocaleString()} · promoted: ${Number(p.promoted || 0).toLocaleString()}`;
}
