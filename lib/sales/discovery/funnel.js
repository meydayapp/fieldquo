// lib/sales/discovery/funnel.js
//
// What a discovery run actually did, in the six numbers spec §56 asks for.
//
// ══ Why this is a pure function over counters ══════════════════════════════
//
// The campaign screen's job is to answer "is this working, and if it found
// fewer than I asked for, where did they go". A screen that shows only
// "accepted: 412" against a target of 1,000 tells a superadmin nothing about
// whether the snapshot was small, the territory was tight, or the classifier
// rejected half a city.
//
// So every stage is shown with its own number, and the numbers add up. That
// arithmetic is asserted by scripts/check-sales-discovery.mjs, because a
// funnel whose rows do not reconcile is worse than no funnel: it looks
// authoritative and is not.
//
// ══ The one line that is NOT a claim about the world ═══════════════════════
//
// "No website" says "the SOURCE listed no website", never "this business has
// no website". Overture's website fill is 92.7% measured, so an empty column
// is a gap in the directory as often as it is a gap in the market. The crawler
// stage is what turns that into a real finding, and until it runs the number
// is labelled for what it is. Calling it "no website" flat would be the
// padding-absent-data failure AGENTS.md lists fifth, printed on a dashboard.

/**
 * The funnel, as rows a screen can render in order.
 *
 * @param {{foundCount:number, unmappedCount:number, duplicateCount:number,
 *          rejectedCount:number, needsReviewCount:number, acceptedCount:number,
 *          readyCount:number, noWebsiteCount:number}} campaign
 * @returns {Array<{key:string,label:string,value:number,note:string,
 *                  kind:"total"|"drop"|"subset"}>}
 *          `kind` tells the screen how to render it: a total, something that
 *          left the funnel, or a property of what is still in it. A subset is
 *          NOT subtracted from anything, and mixing the two is how a funnel
 *          stops adding up.
 */
export function funnelRows(campaign = {}) {
  const n = (key) => {
    const value = Number(campaign?.[key]);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  };

  return [
    {
      key: "found",
      label: "Found in the source",
      value: n("foundCount"),
      note: "Rows the provider returned for this territory and trade.",
      kind: "total",
    },
    {
      key: "unmapped",
      label: "Not usable for this campaign",
      value: n("unmappedCount"),
      // Three reasons, one bucket, all of them "this row cannot go into THIS
      // queue". Spelled out rather than labelled "unmapped", because a
      // superadmin seeing a big number here needs to know whether the trade
      // map has a gap or the snapshot was extracted too broadly — those have
      // different fixes.
      note:
        "The source's category maps to no FieldQuo trade, or maps to a different trade from this " +
        "campaign's, or the row carried no name or id. Never guessed into the nearest trade.",
      kind: "drop",
    },
    {
      key: "duplicates",
      label: "Duplicates removed",
      value: n("duplicateCount"),
      note: "The same source record already held. Refreshed in place, not written twice.",
      kind: "drop",
    },
    {
      key: "rejected",
      label: "Shops and suppliers rejected",
      value: n("rejectedCount"),
      note: "Classified as a retailer or a wholesaler rather than a contractor.",
      kind: "drop",
    },
    {
      key: "needsReview",
      label: "Needs review",
      value: n("needsReviewCount"),
      note: "Could be either. Written, but held back from every rep's queue until a human decides.",
      kind: "drop",
    },
    {
      key: "accepted",
      label: "Accepted as contractors",
      value: n("acceptedCount"),
      note: "Written as prospects and available to work.",
      kind: "total",
    },
    {
      key: "noWebsite",
      label: "No website listed by the source",
      value: n("noWebsiteCount"),
      note:
        "A signal, not a disqualifier — these stay in the pipeline. It is not the same claim as " +
        "“this business has no website”, which only a crawl can make.",
      kind: "subset",
    },
    {
      key: "ready",
      label: "Ready to call",
      value: n("readyCount"),
      note: "Accepted, with a phone number and a full street address.",
      kind: "subset",
    },
  ];
}

/**
 * Do the numbers reconcile?
 *
 * found = unmapped + duplicates + rejected + needsReview + accepted, and the
 * two subsets never exceed accepted. Returned as findings rather than thrown,
 * so the screen can SAY the totals disagree instead of rendering a funnel that
 * quietly does not add up.
 */
export function funnelProblems(campaign = {}) {
  const n = (key) => {
    const value = Number(campaign?.[key]);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  };

  const problems = [];
  const parts =
    n("unmappedCount") + n("duplicateCount") + n("rejectedCount") + n("needsReviewCount") + n("acceptedCount");
  if (n("foundCount") !== parts) {
    problems.push(
      `The stages total ${parts} against ${n("foundCount")} found — some rows were neither counted nor dropped.`,
    );
  }
  if (n("readyCount") > n("acceptedCount")) {
    problems.push("More prospects are ready to call than were accepted, which cannot be true.");
  }
  if (n("noWebsiteCount") > n("acceptedCount")) {
    problems.push("More prospects have no website than were accepted, which cannot be true.");
  }
  return problems;
}

/**
 * How far through its target a campaign is.
 *
 * Against ACCEPTED, not found. A superadmin asking for 1,000 painting
 * contractors wants a thousand contractors, and counting the paint stores
 * toward that would let a campaign report itself complete having produced six
 * hundred callable rows.
 */
export function campaignProgress(campaign = {}) {
  const target = Math.max(0, Math.floor(Number(campaign?.targetCount) || 0));
  const accepted = Math.max(0, Math.floor(Number(campaign?.acceptedCount) || 0));
  if (!target) return { target: 0, accepted, percent: null };
  return { target, accepted, percent: Math.min(100, Math.round((accepted / target) * 100)) };
}

/**
 * Should discovery keep going?
 *
 * Three reasons to stop, and they are different states rather than one
 * "finished":
 *
 *   target_reached  the campaign has what it asked for
 *   source_ended    the provider ran out of rows before the target. The
 *                   campaign is DONE, and the screen must say the source had
 *                   no more rather than implying success.
 *   paused/cancelled by a human
 */
export function discoveryStopReason(campaign = {}, { nextCursor = null } = {}) {
  if (campaign?.status === "paused") return "paused";
  if (campaign?.status === "cancelled") return "cancelled";
  const { target, accepted } = campaignProgress(campaign);
  if (target && accepted >= target) return "target_reached";
  if (!nextCursor) return "source_ended";
  return null;
}
