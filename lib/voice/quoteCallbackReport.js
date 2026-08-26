// lib/voice/quoteCallbackReport.js
//
// "No calls waiting" is true and useless. This is what the card says instead.
//
// ══ The failure this exists to fix ═════════════════════════════════════════
//
// An owner turned the quote callback on, wrote a quote, sent it, and no call
// came. The card said "It's calling clients — turn off" above "No calls
// waiting". Both sentences were accurate. Together they described an armed
// feature that would never fire once, because every quote he writes is typed by
// hand and the gate only ever covered instant estimates.
//
// That is the dead-control failure wearing a different hat. The button works,
// the column is written, the cron reads it — and there is still nothing the
// owner could do with what the screen told him. So the screen now names the
// quotes that were passed over and why, in the gate's own vocabulary.
//
// ══ It runs the real gate, it does not describe it ═════════════════════════
//
// approvedQuoteCallGate, on rows selected with QUOTE_CALLBACK_SELECT — the same
// function and the same columns the trigger uses. A hand-written "if it isn't an
// instant estimate, say so" here would be a second copy of the rule, and the
// copy is the one that rots because it is the one nobody looks at.
//
// The one thing the gate cannot answer is consent: it takes no database, on
// purpose, so scripts can execute it. Consent is the wall a company hits
// straight after widening the scope — a client typed in by hand from a phone
// call has no consent row, and mayCall will refuse at dial time. Reporting the
// enqueue refusals alone would move the silent dead end four hours later
// instead of removing it, so the standing of each number is read here and
// folded in under its own code.
import { db } from "@/lib/db";
import { toE164 } from "./numbers";
import { liveConsent } from "./outbound";
import {
  approvedQuoteCallGate,
  QUOTE_CALLBACK_SELECT,
  QUOTE_CALLBACK_PURPOSE,
} from "./triggers";
import { CALLBACK_REFUSED } from "./quoteCallScope";

const DAY = 24 * 60 * 60 * 1000;

/** How far back "recently" reaches, and how many rows are examined. */
export const REPORT_DAYS = 30;
const REPORT_QUOTES = 25;
/** How many individual quotes the card lists before it stops naming them. */
export const REPORT_ROWS = 4;

/**
 * The verdict for each quote, and the one sentence that covers most of them.
 *
 * Pure — every input is a plain object — so scripts/check-voice-quote-scope.mjs
 * runs the awkward mixes (some called, some refused for different reasons, none
 * refused at all) instead of somebody reading this and agreeing with it.
 *
 * @param quotes       rows shaped like QUOTE_CALLBACK_SELECT, plus quoteNumber
 *                     and client.name, newest first
 * @param taskByQuote  { [quoteId]: status } for tasks already queued or placed
 * @param standing     { [e164]: { optedOut: bool, consents: [...] } }
 * @returns {{ considered, queued, called, refusals, headline }}
 */
export function summariseQuoteCallbacks({
  quotes = [],
  taskByQuote = {},
  standing = {},
  now = new Date(),
} = {}) {
  let queued = 0;
  let called = 0;
  const refusals = [];

  for (const quote of quotes) {
    // A quote with a task is not a refusal — it is the feature working, and
    // showing it under "wasn't called" would be a lie in the other direction.
    const taskStatus = taskByQuote[quote.id];
    if (taskStatus === "queued" || taskStatus === "calling") {
      queued++;
      continue;
    }
    if (taskStatus === "done") {
      called++;
      continue;
    }

    const gate = approvedQuoteCallGate(quote);
    let reason = gate.allowed ? null : gate.reason;

    // Only asked of quotes the gate would otherwise let through. A quote
    // refused for having no phone number has no number to have consent for, and
    // reporting the deeper reason would send the owner to fix the wrong thing.
    if (!reason) {
      const e164 = toE164(quote.client?.phone);
      const rows = (e164 && standing[e164]) || null;
      if (!rows || rows.optedOut || !liveConsent(rows.consents || [], now)) {
        reason = CALLBACK_REFUSED.NO_CONSENT;
      }
    }

    // Allowed, no task, nothing missing: the trigger has fired or is about to.
    // Counted nowhere rather than invented into a category.
    if (!reason) continue;

    refusals.push({
      quoteNumber: quote.quoteNumber || null,
      clientName: quote.client?.name || null,
      reason,
    });
  }

  // The reason that blocks the most quotes, so the card can lead with one
  // sentence before the list. Ties break toward the first seen, which is the
  // most recent quote — the one the owner just sent and is asking about.
  const counts = {};
  for (const r of refusals) counts[r.reason] = (counts[r.reason] || 0) + 1;
  let headline = null;
  for (const r of refusals) {
    if (!headline || counts[r.reason] > headline.count) {
      headline = { reason: r.reason, count: counts[r.reason] };
    }
  }

  return {
    considered: quotes.length,
    queued,
    called,
    refusals: refusals.slice(0, REPORT_ROWS),
    // The list is capped for the screen; the headline counts every one.
    moreRefusals: Math.max(0, refusals.length - REPORT_ROWS),
    headline,
  };
}

/**
 * The report for one company, from the database.
 *
 * Scoped to quotes that were actually EMAILED in the window. A draft nobody
 * sent is not a call that failed to happen, and listing it would bury the
 * quotes the owner is actually asking about.
 */
export async function quoteCallbackReport(companyId, { now = new Date() } = {}) {
  if (!companyId) return null;

  const quotes = await db.quote.findMany({
    where: {
      companyId,
      sentAt: { not: null, gte: new Date(now.getTime() - REPORT_DAYS * DAY) },
    },
    orderBy: { sentAt: "desc" },
    take: REPORT_QUOTES,
    select: {
      ...QUOTE_CALLBACK_SELECT,
      quoteNumber: true,
      // QUOTE_CALLBACK_SELECT takes the phone the gate needs; the card also
      // names who the quote was for, because "Q-2026-0011" alone means nothing
      // to somebody who writes ten a week.
      client: { select: { phone: true, name: true } },
    },
  });

  if (!quotes.length) {
    return { considered: 0, queued: 0, called: 0, refusals: [], moreRefusals: 0, headline: null };
  }

  const quoteIds = quotes.map((q) => q.id);
  const e164s = [...new Set(quotes.map((q) => toE164(q.client?.phone)).filter(Boolean))];

  const [tasks, consents] = await Promise.all([
    db.voiceCallTask.findMany({
      where: { companyId, purpose: QUOTE_CALLBACK_PURPOSE, quoteId: { in: quoteIds } },
      select: { quoteId: true, status: true },
    }),
    e164s.length
      ? db.callConsent.findMany({
          where: { companyId, e164: { in: e164s } },
          orderBy: { createdAt: "desc" },
          select: { e164: true, source: true, createdAt: true, optedOutAt: true },
        })
      : [],
  ]);

  const taskByQuote = {};
  for (const t of tasks) {
    // A quote can hold a skipped attempt and a live one. The live status wins,
    // so a re-queued call doesn't read as "we gave up on this".
    const rank = { queued: 3, calling: 3, done: 2 };
    const current = taskByQuote[t.quoteId];
    if (!current || (rank[t.status] || 1) > (rank[current] || 1)) taskByQuote[t.quoteId] = t.status;
  }

  const standing = {};
  for (const c of consents) {
    const row = (standing[c.e164] ||= { optedOut: false, consents: [] });
    if (c.optedOutAt) row.optedOut = true;
    else row.consents.push(c);
  }

  return summariseQuoteCallbacks({ quotes, taskByQuote, standing, now });
}
