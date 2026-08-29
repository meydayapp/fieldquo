// lib/analytics/winLoss.js
//
// What went out, what came back, and — where anybody said — why it didn't.
//
// ══ The gap this closes ════════════════════════════════════════════════════
//
// `Quote.declineReason` has been written on every decline since it existed,
// through both doors (the public approval link and the back-office status
// change, both via lib/quotes/quoteLifecycle.js). The only things that ever
// READ it were FieldQuo's own console — app/platform/TenantBoard.js counts it
// and lib/analytics/tenantData.js ships it to the platform AI. So the product
// collected why a contractor loses work, showed it to us, and never showed it
// to them. The schema comment on the field already argues the case: a win rate
// alone tells a contractor they are losing and nothing about what to change.
//
// ══ The rules this file is built around ════════════════════════════════════
//
// 1. **null is not a category.** A lost quote with no reason is counted as
//    UNEXPLAINED and reported as its own number. It is never folded into
//    "other", never assumed to be price, and never dropped so the remaining
//    reasons can be presented as if they were the whole picture. If nine of ten
//    losses are silent, the finding is "start asking", not a chart of the tenth.
//
// 2. **A small sample is not a pattern.** Percentages are printed only once a
//    single quote can move the rate by no more than ten points — that is
//    SAMPLE_FLOOR = 10 decided quotes, and it is the whole justification. Below
//    it every rate comes back `null` with a reason code, so a screen cannot
//    print one by accident. Counts are always returned: "3 of 4" is honest at
//    any n; "75%" is not.
//
// 3. **Free text is not clustered.** No taxonomy, no keyword buckets, no
//    model-invented labels. The reasons come back verbatim, newest first, with
//    the quote and client attached. A shop sending forty quotes a quarter loses
//    maybe ten and hears a reason on three; grouping three sentences into
//    categories is how a report starts making claims the client never made.
//    The raw text IS the report at these volumes.
//
// 4. **Absence is stated, not padded.** A quote with no `sentAt` belongs to no
//    period and is reported as an excluded count rather than dated by guess. A
//    decision with no timestamp is dropped from the average rather than
//    counted as zero days — the same rule the `acceptedAt`/`declinedAt` schema
//    comment states.
//
// 5. **Outstanding is neither won nor lost.** The win rate divides by DECIDED
//    quotes, never by everything sent. Dividing by sent makes every quote still
//    under consideration look like a loss, which understates a busy month
//    exactly when the contractor is trying to read it.
//
// ══ Deliberately no AI ═════════════════════════════════════════════════════
//
// lib/ai/monthlyDigest.js is the precedent for an LLM phrasing a summary, and
// it is a good one — but every sentence this report can honestly produce is
// a function of six integers, so the sentences are produced in code as
// `notes` (a code plus its numbers, translated at the edge). A model
// paraphrasing six integers adds a way to be wrong and nothing else, and a
// model reading the free text would be doing exactly the clustering rule 3
// forbids.

/**
 * The number of DECIDED quotes below which no percentage is printed.
 *
 * Ten, because at ten a single quote flipping moves the rate by ten points and
 * at any larger n by less. Anything under that is a rate that changes by more
 * than the change a contractor would act on, so the honest output is the
 * counts and a sentence saying the sample is too small — not a number that
 * will read as precise because it has a percent sign after it.
 */
export const SAMPLE_FLOOR = 10;

/** A finite number, or null. Never NaN, never a silent zero. */
function num(value) {
  if (value === null || value === undefined || value === "") return null;
  // Prisma Decimal arrives as an object with toNumber(); a JSON round-trip
  // makes it a string. Both, plus plain numbers, plus junk.
  const n =
    typeof value === "object" && typeof value.toNumber === "function"
      ? value.toNumber()
      : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** A Date, or null. Accepts Date, ISO string, epoch ms. */
function asDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Trimmed text, or null. Whitespace is silence, not a statement. */
function text(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const DAY_MS = 86400000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function rangeError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/**
 * Quotes → OPPORTUNITIES.
 *
 * A Good/Better/Best trio is three Quote rows sharing a `tierGroupId`
 * (app/api/quotes/tier-group/route.js) and ONE decision by one homeowner.
 * Nothing marks the siblings declined when the client picks one, so counting
 * the rows would score that win as one win and two quotes left hanging
 * forever — a shop that quotes in tiers would read a win rate a third of its
 * real one and a permanently growing "still out" column.
 *
 * So a tier group collapses to one opportunity:
 *
 *   won         any sibling accepted (the client picked a price)
 *   lost        at least one sibling declined and none accepted
 *   outstanding otherwise
 *
 * The VALUE of a lost or outstanding group is the LOWEST sibling total, which
 * is the only figure that cannot overstate the loss: the client turned down
 * every price, so the smallest is the most we can claim was on the table. A
 * won group uses the accepted sibling's own accepted total, which is not a
 * choice at all — it is what they signed.
 */
export function toOpportunities(quotes) {
  if (!Array.isArray(quotes)) {
    throw new TypeError("toOpportunities: quotes must be an array");
  }

  const groups = new Map();
  for (const row of quotes) {
    if (!row || typeof row !== "object") continue;
    // A row with no id and no tier group is still one opportunity; keying on
    // the object itself keeps it separate rather than merging every such row
    // under the key `undefined`.
    const key = text(row.tierGroupId) || row.id || row;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const out = [];
  for (const siblings of groups.values()) {
    const accepted = siblings.find((q) => q.status === "accepted") || null;
    const declined = siblings.filter((q) => q.status === "declined");

    const outcome = accepted ? "won" : declined.length ? "lost" : "outstanding";

    // The earliest send is when this opportunity left the building. Null when
    // no sibling was ever stamped — such a group belongs to no period and the
    // caller reports it as an exclusion rather than dating it by guess.
    const sentAt = siblings
      .map((q) => asDate(q.sentAt))
      .filter(Boolean)
      .sort((a, b) => a - b)[0] || null;

    // Won: when they said yes. Lost: the LAST no, which is the moment the whole
    // opportunity was gone rather than the moment one option was.
    const decidedAt = accepted
      ? asDate(accepted.acceptedAt)
      : declined
          .map((q) => asDate(q.declinedAt))
          .filter(Boolean)
          .sort((a, b) => b - a)[0] || null;

    let value = null;
    if (accepted) {
      value = num(accepted.acceptedTotal);
      if (value === null) value = num(accepted.total);
    } else {
      const totals = siblings.map((q) => num(q.total)).filter((n) => n !== null);
      value = totals.length ? Math.min(...totals) : null;
    }

    // Whoever wrote the quote that decided it; failing that, whoever wrote the
    // first one out. Null stays null — an unattributed quote is not assigned to
    // anybody for the sake of a tidy table.
    const source = accepted || declined[0] || siblings[0];

    // Every reason anybody gave against this opportunity, verbatim. A trio can
    // in principle carry more than one; both are the client's own words and
    // neither is dropped.
    const reasons = siblings
      .map((q) => text(q.declineReason))
      .filter(Boolean);

    out.push({
      id: source?.id ?? null,
      quoteNumber: source?.quoteNumber ?? null,
      clientName: text(source?.client?.name),
      tiered: siblings.length > 1,
      outcome,
      sentAt,
      decidedAt,
      value,
      reasons,
      estimatorId: source?.createdById ?? null,
      estimatorName: text(source?.createdBy?.name),
    });
  }
  return out;
}

/** Median of a non-empty numeric array. */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * A rate, or null with the reason it is null.
 *
 * Two different nulls, kept apart because they mean opposite things to the
 * reader: nothing has been decided yet, versus too few decisions to draw a
 * rate from. Collapsing them into one blank is how a quiet month and an
 * unreadable one come to look the same.
 */
function rate(numerator, denominator) {
  if (denominator <= 0) return { value: null, suppressed: "none_yet", n: 0 };
  if (denominator < SAMPLE_FLOOR)
    return { value: null, suppressed: "below_floor", n: denominator };
  return { value: numerator / denominator, suppressed: null, n: denominator };
}

/**
 * The report.
 *
 * @param {object}   input
 * @param {string}   input.from          YYYY-MM-DD, inclusive (UTC)
 * @param {string}   input.to            YYYY-MM-DD, inclusive (UTC)
 * @param {object[]} input.quotes        Quote rows; see toOpportunities
 * @param {number}   [input.undatedCount] quotes that left draft and carry no
 *   `sentAt` at all, company-wide. They are in NO period and are reported as
 *   an exclusion so the totals never quietly disagree with the quote list.
 * @param {number}   [input.verbatimLimit]
 */
export function buildWinLoss({
  from,
  to,
  quotes,
  undatedCount = 0,
  verbatimLimit = 50,
}) {
  if (!DAY_RE.test(from || "") || !DAY_RE.test(to || "")) {
    throw rangeError("Give a start and end date as from=YYYY-MM-DD&to=YYYY-MM-DD.");
  }
  if (from > to) {
    throw rangeError(`The period runs backwards (${from} to ${to}).`);
  }

  const startTs = Date.parse(`${from}T00:00:00.000Z`);
  const endTs = Date.parse(`${to}T23:59:59.999Z`);

  const all = toOpportunities(quotes);

  // An opportunity with no send date is not in this period and not in any
  // other. Counted, named, and left out of every figure.
  const undatedInRows = all.filter((o) => !o.sentAt).length;
  const inRange = all.filter(
    (o) => o.sentAt && o.sentAt.getTime() >= startTs && o.sentAt.getTime() <= endTs,
  );

  const won = inRange.filter((o) => o.outcome === "won");
  const lost = inRange.filter((o) => o.outcome === "lost");
  const outstanding = inRange.filter((o) => o.outcome === "outstanding");
  const decided = won.length + lost.length;

  // ── Money ────────────────────────────────────────────────────────────────
  //
  // Summed over opportunities that HAVE a usable figure; the rest are counted
  // as `unpriced` rather than added in as zero. `Quote.total` defaults to 0 in
  // the schema, so this is mostly a guard against junk arriving from a future
  // caller — but a total that cannot be read must not silently deflate the
  // number a contractor quotes back to their bank.
  const sumValue = (rows) => {
    const priced = rows.map((o) => o.value).filter((v) => v !== null);
    return {
      amount: priced.reduce((a, b) => a + b, 0),
      counted: priced.length,
      unpriced: rows.length - priced.length,
    };
  };

  // ── Time to decision ─────────────────────────────────────────────────────
  //
  // Nulls are DROPPED, never treated as zero — the acceptedAt/declinedAt schema
  // comment says so explicitly, and a quote decided before those columns
  // existed would otherwise report as "decided the same day" and drag the
  // average toward a claim nobody can support.
  //
  // A negative span is dropped too and counted with the rest. Re-sending a
  // quote overwrites `sentAt` while `acceptedAt` is written once (first answer
  // wins, by design), so a re-sent quote can legitimately show a decision
  // BEFORE its send date. That is not a fast decision; it is an unmeasurable
  // one.
  const spans = [];
  let unmeasurable = 0;
  for (const o of [...won, ...lost]) {
    if (!o.sentAt || !o.decidedAt) {
      unmeasurable += 1;
      continue;
    }
    const days = (o.decidedAt.getTime() - o.sentAt.getTime()) / DAY_MS;
    if (!Number.isFinite(days) || days < 0) {
      unmeasurable += 1;
      continue;
    }
    spans.push(days);
  }

  const timeToDecision = {
    measured: spans.length,
    dropped: unmeasurable,
    medianDays: spans.length ? round1(median(spans)) : null,
    // The mean is reported beside the median rather than instead of it: one
    // quote that sat for four months moves a mean of eight and barely moves
    // the median, and a contractor reading only the mean would conclude their
    // clients are slow when one of them was.
    meanDays: spans.length
      ? round1(spans.reduce((a, b) => a + b, 0) / spans.length)
      : null,
  };

  // ── Reasons ──────────────────────────────────────────────────────────────
  //
  // Explained / unexplained, and nothing else. No cluster, no "other".
  const explained = lost.filter((o) => o.reasons.length > 0);
  const unexplained = lost.length - explained.length;

  const verbatim = explained
    .slice()
    .sort((a, b) => {
      const at = a.decidedAt?.getTime() ?? a.sentAt?.getTime() ?? 0;
      const bt = b.decidedAt?.getTime() ?? b.sentAt?.getTime() ?? 0;
      return bt - at;
    })
    .slice(0, Math.max(0, verbatimLimit))
    .map((o) => ({
      quoteId: o.id,
      quoteNumber: o.quoteNumber,
      clientName: o.clientName,
      decidedAt: o.decidedAt ? o.decidedAt.toISOString() : null,
      value: o.value,
      // Plural because a tier group can carry one per option. Never joined into
      // a sentence — two people said two things.
      reasons: o.reasons,
    }));

  // ── Who wrote them ───────────────────────────────────────────────────────
  //
  // The one segmentation offered, and only when it survives the floor. Buckets
  // by PERSON concentrate the sample where buckets by service or by month
  // shred it — a shop with three estimators and sixty decisions has three
  // buckets of twenty, while the same sixty split by trade is a table of ones.
  //
  // Quotes with no author are excluded from the comparison and reported as a
  // count: "not recorded" is not a colleague, and ranking it against two named
  // people would invite a comparison that means nothing.
  const byEstimator = (() => {
    const buckets = new Map();
    let unattributed = 0;
    for (const o of [...won, ...lost]) {
      if (!o.estimatorId) {
        unattributed += 1;
        continue;
      }
      if (!buckets.has(o.estimatorId)) {
        buckets.set(o.estimatorId, {
          id: o.estimatorId,
          name: o.estimatorName,
          won: 0,
          lost: 0,
        });
      }
      const b = buckets.get(o.estimatorId);
      if (o.outcome === "won") b.won += 1;
      else b.lost += 1;
    }

    const qualifying = [...buckets.values()]
      .map((b) => ({ ...b, decided: b.won + b.lost }))
      .filter((b) => b.decided >= SAMPLE_FLOOR)
      .map((b) => ({ ...b, winRate: b.won / b.decided }))
      .sort((a, b) => b.winRate - a.winRate);

    // One bucket is not a comparison — it is the company total with a name on
    // it, and printing it invites the reader to compare it against nothing.
    if (qualifying.length < 2) {
      return { rows: [], unattributed, suppressed: "below_floor" };
    }
    return { rows: qualifying, unattributed, suppressed: null };
  })();

  // ── The sentences, as codes ──────────────────────────────────────────────
  //
  // Codes and numbers, not English: the page translates them. Every one is a
  // function of the counts above, which is why this report needs no model to
  // say what it means.
  const notes = [];
  if (inRange.length === 0) {
    notes.push({ code: "no_activity" });
  } else if (decided === 0) {
    notes.push({ code: "all_outstanding", outstanding: outstanding.length });
  } else if (decided < SAMPLE_FLOOR) {
    notes.push({ code: "below_floor", decided, floor: SAMPLE_FLOOR });
  }
  if (lost.length > 0 && explained.length === 0) {
    notes.push({ code: "no_reasons_at_all", lost: lost.length });
  } else if (lost.length > 0 && unexplained >= explained.length) {
    notes.push({
      code: "mostly_unexplained",
      unexplained,
      lost: lost.length,
    });
  }
  if (undatedCount > 0 || undatedInRows > 0) {
    notes.push({
      code: "undated_excluded",
      count: Math.max(undatedCount, undatedInRows),
    });
  }

  return {
    range: { from, to },
    sampleFloor: SAMPLE_FLOOR,
    // False when nothing went out in this window. The page renders a sentence
    // saying so — a 0% win rate over an empty range is a statement about the
    // contractor's selling, and the data does not make it.
    hasData: inRange.length > 0,
    counts: {
      sent: inRange.length,
      won: won.length,
      lost: lost.length,
      outstanding: outstanding.length,
      decided,
    },
    winRate: rate(won.length, decided),
    value: {
      won: sumValue(won),
      lost: sumValue(lost),
      outstanding: sumValue(outstanding),
    },
    timeToDecision,
    reasons: {
      lost: lost.length,
      explained: explained.length,
      // Its own number, never a category and never folded into one.
      unexplained,
      unexplainedShare: rate(unexplained, lost.length),
      verbatim,
    },
    byEstimator,
    // Named exclusions, so the page can account for every quote the contractor
    // can see on the quotes list.
    excluded: { undated: Math.max(undatedCount, undatedInRows) },
    notes,
  };
}
