// lib/sales/discovery/suggestedGroups.js
//
// The fixed cards of the Review folder's By-suggestion mode, beside the one
// card per suggested trade.
//
// The owner's ask (2026-09-13): "take a look at the name of the company and
// use AI to infer the trade … It might put it in a list for me to confirm by
// batches." A batch is only confirmable when everything in it wants the SAME
// answer, so the cards are cut by what the answer would be:
//
//   <trade>        trade-less rows whose name (licence, site) says this trade.
//                  "Accept N as HVAC" writes that one key.
//   agree          rows that ALREADY carry a trade (an Overture category put
//                  it there; they are in the folder as needs_review) and whose
//                  name says the same. The coordinator's example: "Fasso Tree
//                  Service · currently Landscaping". High confidence, one
//                  click, and the accept writes each row's OWN current trade.
//   conflict       rows with a trade whose name says a DIFFERENT one. Both are
//                  shown; nothing is picked for the reviewer — the card offers
//                  "accept as current" AND "accept as the name's trade", and
//                  the reviewer ticks rows for one of them. Unchecked by
//                  default — the one card where reading is the work.
//   mixed          a shop word beside a trade word ("Green Tree Nursery and
//                  Landscape", "Huber Farms & Excavating"). classify.js's
//                  three-valued answer, kept three-valued: the trade chip is
//                  shown, and the reviewer accepts as that trade or rejects.
//   not_contractor a shop word and nothing else: "Reject N as not contractors".
//   none           computed, and nothing in the name, the licence, the site
//                  or the domain named a trade. Phase 2's population.
//   current_only   a trade already, and no name signal either way. Nothing to
//                  confirm in bulk; the row-by-row mode has them.
//   pending        not computed yet. A count, and a button.
//
// `accept` lists WHICH trade sources a bulk accept may write for the card —
// "given" (the card's own key), "current" (each row's tradeKey), "suggested"
// (each row's first suggested key) — and is empty where accepting in bulk
// would be picking for the reviewer. reviewBulk.js reads the same words and
// the bulk route refuses a source the card does not list.

export const SUGGESTED_GROUPS = Object.freeze({
  agree: {
    label: "Name agrees with the current trade",
    note: "Already carries a trade from the source's category, and the name says the same. Accepting writes each row's own trade.",
    accept: ["current"],
    reject: false,
    checkedByDefault: true,
  },
  conflict: {
    label: "Name disagrees with the current trade",
    note: "Carries a trade from the source, and the name says a different one. Both are shown; nothing is picked for you.",
    accept: ["current", "suggested"],
    reject: false,
    checkedByDefault: false,
  },
  mixed: {
    label: "Shop word beside a trade word",
    note: "A nursery that also landscapes, a farm that also excavates. Accept as the trade the name carries, or reject as not a contractor.",
    accept: ["suggested"],
    reject: true,
    checkedByDefault: true,
  },
  not_contractor: {
    label: "Not a contractor",
    note: "A supply house, a depot, a farm, a nursery, a products company. Rejecting marks them do-not-contact.",
    accept: [],
    reject: true,
    checkedByDefault: true,
  },
  none: {
    label: "No suggestion",
    note: "Nothing in the name, the licence, a crawl or the domain names a trade. What Phase 2 (AI over the name) is for.",
    accept: [],
    reject: false,
    checkedByDefault: false,
  },
  current_only: {
    label: "Current trade only",
    note: "Carries a trade already and the name says nothing either way. Row-by-row mode has them.",
    accept: [],
    reject: false,
    checkedByDefault: false,
  },
  pending: {
    label: "Not computed yet",
    note: "Rows the suggestion batch has not reached.",
    accept: [],
    reject: false,
    checkedByDefault: false,
  },
});

/** The trade sources a bulk accept may use for a card. Empty: no bulk accept. */
export function suggestedGroupAccepts(key, { isTradeKey }) {
  if (isTradeKey(key)) return ["given"];
  return [...(SUGGESTED_GROUPS[key]?.accept || [])];
}

/** A trade card offers reject too: a name that says "roofing" can still be
 *  a roofing supplier the word list missed, and the reviewer sees it. */
export function suggestedGroupReject(key, { isTradeKey }) {
  if (isTradeKey(key)) return true;
  return Boolean(SUGGESTED_GROUPS[key]?.reject);
}
