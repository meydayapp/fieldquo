// lib/sales/emailInbox.js
//
// The inbox list's arithmetic: what a row says about a thread, and which
// threads a folder or a search shows.
//
// ══ Labels are derived, not stored ════════════════════════════════════════
//
// Zero (docs/sales-intel/ZERO-STUDY.md §2) stores labels on the provider —
// Gmail's — and renders them. Ours are FACTS about the thread that the rows
// already hold, computed here on every read: the lead's stage is
// SalesLead.status; "needs a reply" is "the last message was theirs";
// "waiting on them" is "the last message was ours"; "check-in due" is an
// open engine draft on the lead; "unread" is lastInboundAt after readAt. A
// stored label is a second copy of one of those facts, and the copy is the
// one that goes stale.
//
// Pure, and executed by scripts/check-sales-email.mjs against every ordering
// of readAt and lastInboundAt, an empty thread, and a thread whose last
// message is a draft (there is no such thing — drafts are another table —
// and the check asserts the list never has to know).

import { LEAD_STATUSES } from "./outreachPipeline";
import { threadListWhere } from "./outreach";
import { splitQuoted } from "./emailQuote";
import { stripMarks } from "./emailFormat";

export const FOLDER_INBOX = "inbox";
export const FOLDER_ARCHIVED = "archived";
export const FOLDER_ALL = "all";
export const FOLDERS = [FOLDER_INBOX, FOLDER_ARCHIVED, FOLDER_ALL];

/** The longest snippet a row shows. */
export const SNIPPET_LENGTH = 140;

/** Is there something the rep has not seen? Both timestamps or nothing. */
export function isUnread({ lastInboundAt, readAt } = {}) {
  if (!lastInboundAt) return false;
  const inbound = new Date(lastInboundAt).getTime();
  if (Number.isNaN(inbound)) return false;
  if (!readAt) return true;
  const read = new Date(readAt).getTime();
  return Number.isNaN(read) || read < inbound;
}

/**
 * The one-line preview under the subject: the last message's visible text,
 * marks stripped, whitespace collapsed, cut at a word.
 */
export function snippetOf(body, max = SNIPPET_LENGTH) {
  const { visible } = splitQuoted(body);
  const flat = stripMarks(visible).replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const atWord = cut.lastIndexOf(" ");
  return `${atWord > max * 0.6 ? cut.slice(0, atWord) : cut}…`;
}

/**
 * The labels a row wears.
 *
 * @param thread   { lastInboundAt, readAt, archivedAt, lead: { status },
 *                   messages: [last message, newest first] }
 * @param checkIn  the lead's open engine draft, or null
 * @returns { unread, needsReply, waiting, checkInDue, stage, archived }
 */
export function threadLabels(thread, { checkIn = null } = {}) {
  const last = Array.isArray(thread?.messages) ? thread.messages[0] : null;
  const stage = LEAD_STATUSES.includes(thread?.lead?.status) ? thread.lead.status : null;
  return {
    unread: isUnread(thread || {}),
    needsReply: last?.direction === "in",
    waiting: last?.direction === "out",
    checkInDue: Boolean(checkIn),
    stage,
    archived: Boolean(thread?.archivedAt),
  };
}

/**
 * The WHERE for a folder, narrowing a scope the caller built with
 * threadListWhere(rep.id) — so the rep scope is the same fragment every
 * other thread query uses, written where the check script can see it, and a
 * folder is a narrowing of the rep's own threads, never a widening. A scope
 * that is not an object collapses to the `__none__` sentinel.
 */
export function folderWhere(scope, folder) {
  const base = scope && typeof scope === "object" && scope.salesRepId ? scope : threadListWhere(null);
  if (folder === FOLDER_ARCHIVED) return { ...base, archivedAt: { not: null } };
  if (folder === FOLDER_ALL) return base;
  return { ...base, archivedAt: null };
}

/** The most a search string is allowed to be. */
export const SEARCH_MAX = 120;

/**
 * The WHERE a search adds: subject, any message body, the lead's business
 * or contact name, the lead's address. Case-insensitive `contains` — a
 * floor's inbox has hundreds of threads, not millions, and Postgres does
 * this in a scan we can afford. Returns null for a blank query so the
 * caller spreads nothing.
 */
export function searchWhere(q) {
  const term = String(q || "").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX);
  if (!term) return null;
  const contains = { contains: term, mode: "insensitive" };
  return {
    OR: [
      { subject: contains },
      { lead: { businessName: contains } },
      { lead: { contactName: contains } },
      { lead: { email: contains } },
      { messages: { some: { body: contains } } },
      { messages: { some: { fromAddress: contains } } },
    ],
  };
}

/** The query-string folder, or the inbox for anything else. */
export function folderOf(value) {
  return FOLDERS.includes(value) ? value : FOLDER_INBOX;
}
