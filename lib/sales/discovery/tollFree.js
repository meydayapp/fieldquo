// lib/sales/discovery/tollFree.js
//
// A toll-free number on a "local contractor" is a fact about the business.
//
// ══ Where this came from ══════════════════════════════════════════════════
//
// The owner, reviewing a New York campaign, noticed the same names coming back
// over and over: "American garage door" on 22 rows across six towns, all on
// +1 888 342 3617. "KeyMe Locksmiths" on 11. "Minute Key" on 8. His reading was
// the right one — a toll-free number usually means a franchise or a company
// covering many locations, not a business in any one of them.
//
// That is why those rows duplicate. A national operation buys a directory
// listing in every town it will drive to, so a snapshot of one state contains
// it once per town, each with a different street address and the same phone.
// The duplicate flag was catching the SYMPTOM; this names the cause.
//
// ══ It is a signal, and deliberately not a rejection ══════════════════════
//
// A multi-branch contractor with a central switchboard is a real business and
// might be a real customer. FieldQuo sells to one-to-twenty-person shops, so a
// national franchise is usually the wrong prospect — but "usually" is not a
// rule a classifier gets to apply on its own, and auto-rejecting on an area
// code would silently drop legitimate businesses that simply bought an 800
// number. So this returns a fact, the review screen shows it, and a human
// decides. Nothing here writes a status.
//
// ══ The list is NANP, and it is closed ════════════════════════════════════
//
// The North American Numbering Plan reserves specific service access codes for
// toll-free. It is not "starts with 8": 801 is Utah and 818 is Los Angeles.
// The assigned codes are 800, 833, 844, 855, 866, 877 and 888. The 822, 880,
// 881, 882, 883, 884, 885, 886, 887 and 889 codes are RESERVED for future
// toll-free use and are included, because a number on one of them is not a
// geographic number either — it is a toll-free code that has not been released
// yet, and treating it as a local area code would be wrong in the one
// direction that matters.
//
// Pure, and executed by scripts/check-prospect-duplicates.mjs against every
// code in the list plus the geographic ones that look like them.

/** Assigned toll-free service access codes. */
export const TOLL_FREE_CODES = Object.freeze([
  "800",
  "833",
  "844",
  "855",
  "866",
  "877",
  "888",
]);

/**
 * Reserved for future toll-free use. Not yet in service, and specifically NOT
 * geographic — so a number carrying one is still not a business's local line.
 */
export const RESERVED_TOLL_FREE_CODES = Object.freeze([
  "822",
  "880",
  "881",
  "882",
  "883",
  "884",
  "885",
  "886",
  "887",
  "889",
]);

const ALL = new Set([...TOLL_FREE_CODES, ...RESERVED_TOLL_FREE_CODES]);

/**
 * Is this an E.164 North American toll-free number?
 *
 * Requires the +1 country code and eleven digits. A number outside NANP is
 * answered `false` rather than guessed at: the UK's 0800 and Australia's 1800
 * are toll-free too, and this file has read neither numbering plan. Saying
 * "no" about a plan nobody checked is the honest answer, and it is the safe
 * direction — the signal fails to appear rather than appearing wrongly.
 */
export function isTollFree(e164) {
  const s = String(e164 ?? "").trim();
  if (!/^\+1\d{10}$/.test(s)) return false;
  return ALL.has(s.slice(2, 5));
}

/** The service access code itself, for a screen that wants to name it. */
export function tollFreeCode(e164) {
  return isTollFree(e164) ? String(e164).slice(2, 5) : null;
}

/**
 * What a screen says about it. Null when there is nothing to say.
 *
 * `sharedWith` is how many OTHER prospects hold the same number — the concrete
 * evidence, and the thing that turns a hunch into an observation. Supplied by
 * the caller because counting it is a database question and this file is pure.
 */
export function tollFreeNote(e164, { sharedWith = 0 } = {}) {
  const code = tollFreeCode(e164);
  if (!code) return null;
  const shared =
    sharedWith > 0
      ? ` The same number is on ${sharedWith} other row${sharedWith === 1 ? "" : "s"} in the bank, which is what a single call centre listed in several towns looks like.`
      : "";
  return (
    `${code} is a toll-free code, not an area code. That usually means a franchise or a ` +
    `company covering many locations rather than a business in this town.${shared}`
  );
}
