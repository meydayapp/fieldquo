// lib/tenders/reminders.js
//
// Deadline reminders for a tender — to the company's OWN team, in the bell
// and as a Web Push, and to nobody else. Run hourly by
// app/api/cron/tender-reminders.
//
// ══ Never to the buyer ═════════════════════════════════════════════════════
//
// The only sender here is notifyEvent (lib/notifications/notify.js), whose
// recipients are resolved from Member rows of this company and whose
// channels are the in-app feed and Web Push. It sends no email and no SMS to
// anyone (see "WHAT ALREADY EMAILS" in lib/notifications/catalog.js), and the
// tender's Contracting Authority email is never read by this file — it is
// not even selected. A buyer who receives a "your tender closes tomorrow"
// email from a bidder's software is a bidder who looks careless at best.
// scripts/check-tenders.mjs asserts no mail or SMS module is reachable from
// this module or the tender routes.
//
// ══ Once each ══════════════════════════════════════════════════════════════
//
// Claim first, then notify: a TenderReminder row unique on (tenderId, kind,
// dueAt) is created before notifyEvent runs, so a second run in the same hour
// — or two overlapping runs — hits the unique index and stops. A closing
// date that MOVES produces a different dueAt, so the new deadline is
// reminded afresh; the old claim stays as the record of what was sent.
//
// ══ Only for companies that have tenders ═══════════════════════════════════
//
// `tenders` is hidden by default (lib/features/registry.js). A company whose
// feature is hidden or locked gets nothing from this cron, even if it has
// rows from a time the feature was on — the reminders follow the screen.
import { OPEN_TENDER_STATUSES } from "./constants";
import { remindersDue, formatInZone } from "./time";

/** Reminder event → notification type (lib/notifications/catalog.js). */
export function notificationTypeFor(mark, tender) {
  if (mark.event === "questions") return "tender.questionsDue";
  if (mark.event === "siteVisit") return tender.siteVisitMandatory ? "tender.siteVisitMandatory" : "tender.siteVisit";
  return "tender.closing";
}

export const REMINDER_SELECT = Object.freeze({
  id: true,
  companyId: true,
  title: true,
  solicitationNumber: true,
  status: true,
  timeZone: true,
  questionsDeadlineDate: true,
  questionsDeadlineTime: true,
  siteVisitDate: true,
  siteVisitTime: true,
  siteVisitMandatory: true,
  closingDate: true,
  closingTime: true,
  closingAt: true,
  createdAt: true,
});

const BATCH = 2000;
const HOUR_MS = 60 * 60 * 1000;

function isUniqueViolation(err) {
  return err?.code === "P2002" || /unique constraint/i.test(String(err?.message || ""));
}

/** The sentence parameters — words and a formatted time, never money. */
export function reminderParams(mark, tender, language) {
  const title = tender.solicitationNumber ? `${tender.solicitationNumber} — ${tender.title}` : tender.title;
  // A date-only deadline has no instant worth printing; its date is.
  const dateOnly =
    (mark.event === "questions" && !tender.questionsDeadlineTime) || (mark.event === "siteVisit" && !tender.siteVisitTime);
  const when = dateOnly
    ? mark.event === "questions"
      ? tender.questionsDeadlineDate
      : tender.siteVisitDate
    : formatInZone(mark.eventAt, tender.timeZone, language);
  return { title, when };
}

/**
 * One run. Everything it touches comes in through `deps`, so the check
 * script executes it against a stub database and a recording notifier.
 *
 * @param {object} deps
 * @param {object} deps.db
 * @param {Function} deps.notify          notifyEvent's signature
 * @param {Function} deps.featureAllowed  (companyId) => Promise<boolean>
 * @param {Date}     [deps.now]
 */
export async function runTenderReminders({ db, notify, featureAllowed, now = new Date() }) {
  const counts = { tenders: 0, companiesSkipped: 0, due: 0, claimed: 0, alreadySent: 0, delivered: 0 };

  const tenders = await db.tender.findMany({
    where: { status: { in: [...OPEN_TENDER_STATUSES] }, closingAt: { gt: new Date(now.getTime() - HOUR_MS) } },
    select: REMINDER_SELECT,
    orderBy: { closingAt: "asc" },
    take: BATCH,
  });
  counts.tenders = tenders.length;
  if (!tenders.length) return counts;

  const companyIds = [...new Set(tenders.map((t) => t.companyId))];
  const companies = await db.company.findMany({
    where: { id: { in: companyIds } },
    select: { id: true, defaultLanguage: true },
  });
  const languageOf = new Map((companies || []).map((c) => [c.id, c.defaultLanguage || "en"]));

  const allowed = new Map();
  for (const companyId of companyIds) {
    let ok = false;
    try {
      ok = (await featureAllowed(companyId)) === true;
    } catch {
      ok = false;
    }
    allowed.set(companyId, ok);
    if (!ok) counts.companiesSkipped += 1;
  }

  for (const tender of tenders) {
    if (!allowed.get(tender.companyId)) continue;
    for (const mark of remindersDue(tender, now, OPEN_TENDER_STATUSES)) {
      counts.due += 1;
      let claim;
      try {
        claim = await db.tenderReminder.create({
          data: { companyId: tender.companyId, tenderId: tender.id, kind: mark.kind, dueAt: mark.dueAt },
          select: { id: true },
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          counts.alreadySent += 1;
          continue;
        }
        throw err;
      }
      counts.claimed += 1;
      const result = await notify({
        companyId: tender.companyId,
        type: notificationTypeFor(mark, tender),
        entityId: tender.id,
        params: reminderParams(mark, tender, languageOf.get(tender.companyId) || "en"),
      });
      const delivered = Number(result?.delivered) || 0;
      counts.delivered += delivered;
      // The count is bookkeeping for support ("did anybody get it?"); the
      // claim above is what makes the reminder once-only, so a failed
      // update here must not undo or repeat anything.
      if (delivered) {
        await db.tenderReminder.update({ where: { id: claim.id }, data: { delivered } }).catch(() => {});
      }
    }
  }
  return counts;
}
