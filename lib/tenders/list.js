// lib/tenders/list.js
//
// The list screen's filters and order, pure, so the screen and the check
// script run the same code. The server sends every tender (a company bids on
// dozens, not thousands) and the win/loss card is computed over all of them
// — a filter changes what is LISTED, never what the summary says.
import { OPEN_TENDER_STATUSES, TENDER_STATUSES } from "./constants";
import { closingState } from "./time";

export const STATUS_FILTERS = Object.freeze(["open", "all", ...TENDER_STATUSES]);
export const CLOSING_FILTERS = Object.freeze(["any", "today", "week", "overdue"]);

/**
 * Overdue: still open on our side and past its closing — a bid that was
 * never marked submitted (or never sent). The one row that needs a person.
 */
export function isOverdue(t, now) {
  return OPEN_TENDER_STATUSES.includes(t?.status) && closingState(t, now).state === "closed";
}

export function filterTenders(tenders, { status = "open", closing = "any" } = {}, now = new Date()) {
  const rows = Array.isArray(tenders) ? tenders : [];
  const s = STATUS_FILTERS.includes(status) ? status : "open";
  const c = CLOSING_FILTERS.includes(closing) ? closing : "any";
  return rows.filter((t) => {
    if (s === "open" && !OPEN_TENDER_STATUSES.includes(t.status)) return false;
    if (s !== "open" && s !== "all" && t.status !== s) return false;
    if (c === "any") return true;
    const st = closingState(t, now).state;
    if (c === "today") return st === "today";
    if (c === "week") return st === "today" || st === "soon";
    if (c === "overdue") return isOverdue(t, now);
    return true;
  });
}

/**
 * Overdue first (somebody must act), then by closing soonest; decided
 * tenders after the open ones, most recently closed first.
 */
export function sortTenders(tenders, now = new Date()) {
  const rank = (t) => (isOverdue(t, now) ? 0 : OPEN_TENDER_STATUSES.includes(t.status) ? 1 : 2);
  const at = (t) => new Date(t.closingAt).getTime() || 0;
  return [...(Array.isArray(tenders) ? tenders : [])].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    return rank(a) === 2 ? at(b) - at(a) : at(a) - at(b);
  });
}
