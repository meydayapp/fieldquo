// lib/sales/demoBooking/book.js
//
// A rep's public demo page: what it shows, and what happens when a prospect
// confirms a slot.
//
// ══ Two doors, one page ══════════════════════════════════════════════════
//
// A prospect arrives either FROM THE INTRO EMAIL — the "Book a 15-minute
// demo" button carries the sealed token lib/sales/outreach/introLink.js
// mints, so the page knows the lead and the language and prefills the form
// — or with the bare link /demo/<code> the rep handed out. The second has
// no token and no lead; it asks for the name and address and links the
// booking to a lead of the rep's with that address when one exists, and to
// none otherwise. Both write the same SalesEvent of type "demo", which is
// the row the rep's own "next step" writes (lib/sales/nextSteps.js), so
// the calendar shows one kind of demo however it was booked.
//
// ══ Refused twice, serialised once ═══════════════════════════════════════
//
// The slot is re-derived from the rep's hours and calendar inside the
// transaction that writes the event, with the rep's row locked FOR UPDATE
// so two prospects confirming 10:00 at once take turns: the second sees the
// first's event and is told the time was taken. A unique index on
// (salesRepId, startAt) would have done the race but not the overlap — a
// 09:50 callback with no end blocks the 10:00 demo — and would refuse rows
// the rep's own calendar legitimately writes at one instant.
//
// A token is single-use: SalesIntroEmail.demoEventId is set with a WHERE on
// null. A second confirm from the same email answers "already booked" with
// the time, and writes nothing. The older demoRequestedAt stamp is set too
// when it was not, so the lead page's timeline reads the same for a request
// with a time and one without.
//
// ══ The invite is best-effort, after the write ═══════════════════════════
//
// The booking is the event row; the email is how the prospect remembers it.
// A mail hiccup must not make the page say "failed" to somebody who then
// books twice. When the rep's mailbox is connected the invite goes through
// deliverOutreach — the reply lands in the rep's own inbox and the thread —
// and when it is not (a bare-link booking for a rep with no mailbox yet) the
// platform sender carries it with Reply-To the rep's work address, and the
// failure of either is a row in the error log, never a refusal.

import { db } from "@/lib/db";
import { after } from "next/server";
import { buildIcs } from "@/lib/calendar/ics";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { appSentence, pushToReps } from "@/lib/notify/push";
import { recordError } from "@/lib/platform/errorLog";
import { deliverOutreach, outreachStatus, repSendingAddress } from "@/lib/sales/outreachSender";
import { sanitiseHeaderText } from "@/lib/sales/outreach";
import { resolveIntroLink } from "@/lib/sales/outreach/introRequests";
import { repNumberFor } from "@/lib/sales/outreach/introSend";
import { resolveLeadTimeZone } from "@/lib/sales/leadTimeZone";
import { fillDemoCopy, repDemoCopy, repDemoLanguage, whenLabel } from "./copy";
import { REP_DEMO_LEAD_MS, REP_DEMO_MINUTES, initialsOf, repDemoSlots, repDemoZone, repFreeAt } from "./slots";

export { REP_DEMO_PATH, repDemoUrl } from "./url";

const REP_SELECT = { id: true, name: true, code: true, email: true, workEmail: true, timeZone: true, demoHours: true, active: true, kind: true, language: true, endedAt: true };

/** The rep behind a code, or null. An influencer's code is a signup link, not a calendar. */
export async function loadRepForDemo(repCode, client = db) {
  const code = String(repCode || "").trim();
  if (!code || code.length > 80) return null;
  const rep = await client.salesRep.findUnique({ where: { code }, select: REP_SELECT });
  if (!rep || !rep.active || rep.endedAt || rep.kind === "influencer") return null;
  return rep;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The rep's events that could overlap the picker's window, as busy input. */
async function eventsAround(client, salesRepId, from, to) {
  return client.salesEvent.findMany({
    where: { salesRepId, status: { not: "cancelled" }, startAt: { gte: new Date(from.getTime() - 24 * 60 * 60 * 1000), lte: to } },
    select: { startAt: true, endAt: true, status: true },
  });
}

/**
 * Open the token against this rep. `null` token is the bare-link door.
 *
 * @returns { ok: true, row: null } | { ok: true, row } | { ok: false, reason }
 */
async function openFor(rep, token, { client, now }) {
  if (!token) return { ok: true, row: null };
  const r = await resolveIntroLink(token, { client, now });
  if (!r.ok) return { ok: false, reason: r.reason === "expired" ? "expired" : "invalid" };
  // A demo token for another rep's page, or a callback token pasted here, is
  // a token that does not open this door.
  if (r.kind !== "demo" || r.row.salesRepId !== rep.id) return { ok: false, reason: "invalid" };
  return { ok: true, row: r.row };
}

/** The language the page speaks: the email's when there is one, else `?lang`, else English. */
function languageFor(row, lang) {
  return repDemoLanguage(row?.language) || repDemoLanguage(lang) || "en";
}

/**
 * What the page shows. Nothing is written.
 *
 * @returns { ok: true, language, repName, initials, timeZone, slots: iso[], prefill,
 *            booked: { at: iso } | null, fromEmail }
 *        | { ok: false, reason: "unknown_rep" | "invalid" | "expired" }
 */
export async function repDemoPageState({ repCode, token = null, lang = null, client = db, now = new Date() } = {}) {
  const rep = await loadRepForDemo(repCode, client);
  if (!rep) return { ok: false, reason: "unknown_rep" };
  const opened = await openFor(rep, token, { client, now });
  if (!opened.ok) return { ok: false, reason: opened.reason };
  const row = opened.row;
  const language = languageFor(row, lang);

  let booked = null;
  if (row?.demoEventId) {
    const ev = await client.salesEvent.findUnique({ where: { id: row.demoEventId }, select: { startAt: true, status: true } });
    if (ev && ev.status !== "cancelled") booked = { at: ev.startAt.toISOString() };
  }

  const { timeZone } = repDemoZone(rep);
  const to = new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000);
  const events = booked ? [] : await eventsAround(client, rep.id, now, to);
  const slots = booked ? [] : repDemoSlots(rep, events, now).map((d) => d.toISOString());

  return {
    ok: true,
    language,
    repName: rep.name,
    initials: initialsOf(rep.name),
    timeZone,
    minutes: REP_DEMO_MINUTES,
    slots,
    prefill: {
      name: row?.lead?.contactName || "",
      email: row?.toAddress || row?.lead?.email || "",
      phone: row?.lead?.phone || "",
      business: row?.lead?.businessName || "",
    },
    booked,
    fromEmail: Boolean(row),
  };
}

/**
 * The prospect confirmed a slot.
 *
 * @returns { ok: true, eventId, at: iso, language, repName, email, when }
 *        | { ok: false, reason: "unknown_rep" | "invalid" | "expired" | "already" | "taken"
 *                       | "past" | "need_name" | "need_email" | "need_slot", at?: iso }
 */
export async function bookRepDemo({ repCode, token = null, slot, name, email, phone, business, lang = null, client = db, now = new Date() } = {}) {
  const rep = await loadRepForDemo(repCode, client);
  if (!rep) return { ok: false, reason: "unknown_rep" };
  const opened = await openFor(rep, token, { client, now });
  if (!opened.ok) return { ok: false, reason: opened.reason };
  const row = opened.row;
  const language = languageFor(row, lang);

  if (row?.demoEventId) {
    const ev = await client.salesEvent.findUnique({ where: { id: row.demoEventId }, select: { startAt: true, status: true } });
    if (ev && ev.status !== "cancelled") return { ok: false, reason: "already", at: ev.startAt.toISOString(), language };
  }

  const cleanName = sanitiseHeaderText(name, 120).trim();
  const cleanEmail = String(email || "").trim().toLowerCase().slice(0, 200);
  const cleanPhone = String(phone || "").trim().slice(0, 40) || null;
  const cleanBusiness = sanitiseHeaderText(business, 200).trim() || null;
  if (!cleanName) return { ok: false, reason: "need_name", language };
  if (!EMAIL_RE.test(cleanEmail)) return { ok: false, reason: "need_email", language };
  const at = new Date(String(slot || ""));
  if (Number.isNaN(at.getTime())) return { ok: false, reason: "need_slot", language };
  if (at.getTime() < now.getTime() + REP_DEMO_LEAD_MS) return { ok: false, reason: "past", language };

  // The lead: the token's, or one of this rep's with the same address.
  let leadId = row?.leadId || null;
  if (!leadId) {
    const found = await client.salesLead.findFirst({ where: { salesRepId: rep.id, email: cleanEmail }, select: { id: true } });
    leadId = found?.id || null;
  }

  let created;
  try {
    created = await client.$transaction(async (tx) => {
      // Serialise this rep's bookings: the second of two simultaneous
      // confirms waits here, then sees the first's event in the re-check.
      await tx.$queryRaw`SELECT "id" FROM "SalesRep" WHERE "id" = ${rep.id} FOR UPDATE`;
      const events = await eventsAround(tx, rep.id, now, new Date(at.getTime() + 24 * 60 * 60 * 1000));
      if (!repFreeAt(rep, events, at.toISOString(), now)) return { refused: "taken" };
      const event = await tx.salesEvent.create({
        data: {
          salesRepId: rep.id,
          type: "demo",
          title: `Demo — booked from the demo page`,
          startAt: at,
          endAt: new Date(at.getTime() + REP_DEMO_MINUTES * 60_000),
          status: "scheduled",
          leadId,
          businessName: cleanBusiness || row?.lead?.businessName || null,
          contactName: cleanName,
          phone: cleanPhone || row?.lead?.phone || null,
          website: row?.lead?.prospect?.websiteUrl || null,
          notes: row
            ? `They booked this from the intro email sent ${row.sentAt.toISOString().slice(0, 10)} to ${row.toAddress}. Confirmation sent to ${cleanEmail}.`
            : `They booked this on your demo page (/demo/${rep.code}). Confirmation sent to ${cleanEmail}.`,
        },
        select: { id: true, startAt: true },
      });
      if (row) {
        const stamped = await tx.salesIntroEmail.updateMany({ where: { id: row.id, demoEventId: null }, data: { demoEventId: event.id, demoRequestedAt: row.demoRequestedAt || now } });
        // The lock is on the rep, not the intro row; a second confirm from
        // the same token behind the first is answered as already booked.
        if (stamped.count === 0) throw Object.assign(new Error("already"), { already: true });
      }
      return { event };
    });
  } catch (err) {
    if (err?.already) {
      const again = await client.salesIntroEmail.findUnique({ where: { id: row.id }, select: { demoEventId: true } }).catch(() => null);
      const ev = again?.demoEventId ? await client.salesEvent.findUnique({ where: { id: again.demoEventId }, select: { startAt: true } }) : null;
      return { ok: false, reason: "already", at: ev?.startAt?.toISOString() || null, language };
    }
    throw err;
  }
  if (created.refused) return { ok: false, reason: created.refused, language };
  const event = created.event;

  // The lead's zone for the label in the email; the rep's for the invite's
  // notes. A prospect who booked from the page did so in their browser's
  // zone, which the email cannot know — the lead's stated or derived zone
  // is the best honest one, then the rep's, and the label names it.
  const leadZone = resolveLeadTimeZone(row?.lead || {}).timeZone;
  const zone = leadZone || repDemoZone(rep).timeZone;
  const when = whenLabel(event.startAt, { language, timeZone: zone });

  // After the response, never on its path.
  afterResponse(async () => {
    await sendRepDemoInvite({ rep, row, event, language, cleanName, cleanEmail, cleanPhone, cleanBusiness, when, client }).catch(async (err) => {
      await recordError({
        area: "sales_outreach",
        code: "rep_demo_invite_not_sent",
        message: `Demo ${event.id} was booked but the invite to ${cleanEmail} failed: ${err?.message || err}`,
        detail: { salesRepId: rep.id, eventId: event.id, leadId },
      }).catch(() => {});
    });
    const who = cleanBusiness || row?.lead?.businessName || cleanName;
    await pushToReps({
      salesRepIds: [rep.id],
      payload: async (repLanguage) => ({
        title: await appSentence(repLanguage, "app.notify.repDemoBooked.title", { business: who }),
        body: await appSentence(repLanguage, "app.notify.repDemoBooked.body", { when: whenLabel(event.startAt, { language: repDemoLanguage(repLanguage) || "en", timeZone: repDemoZone(rep).timeZone }) }),
        tag: `sales-demo:${event.id}`,
        url: leadId ? `/sales/leads/${encodeURIComponent(leadId)}` : "/sales/calendar",
      }),
    }).catch(() => {});
  });

  return { ok: true, eventId: event.id, at: event.startAt.toISOString(), language, repName: rep.name, email: cleanEmail, when };
}

/**
 * Run after the response is sent. `after()` throws outside a request scope
 * — scripts/check-rep-demo-page.mjs calls bookRepDemo directly — and there
 * the work simply runs now; the booking is already written either way.
 */
function afterResponse(fn) {
  try {
    after(fn);
  } catch {
    void fn();
  }
}

/** The confirmation with the .ics — through the rep's mailbox when it is connected. */
async function sendRepDemoInvite({ rep, row, event, language, cleanName, cleanEmail, cleanPhone, cleanBusiness, when, client }) {
  const copy = repDemoCopy(language);
  const repName = sanitiseHeaderText(rep.name, 120) || "FieldQuo";
  const business = cleanBusiness || row?.lead?.businessName || cleanName;
  const repPhone = await repNumberFor(rep.id, client).catch(() => null);
  const values = { rep: repName, when, name: cleanName.split(/\s+/)[0] || cleanName, phone: cleanPhone || "", business, email: cleanEmail };
  const ics = buildIcs({
    uid: `sales-demo-${event.id}@fieldquo.com`,
    start: event.startAt,
    end: new Date(event.startAt.getTime() + REP_DEMO_MINUTES * 60_000),
    summary: fillDemoCopy(copy.ics_summary, values),
    description: fillDemoCopy(copy.ics_description, values) + (repPhone ? ` ${repPhone}` : ""),
    location: cleanPhone ? `Phone — ${cleanPhone}` : "Phone",
    organizerName: repName,
    organizerEmail: repSendingAddress(rep) || undefined,
    attendeeName: cleanName,
    attendeeEmail: cleanEmail,
  });
  const attachments = [{ filename: "fieldquo-demo.ics", content: Buffer.from(ics).toString("base64") }];
  const subject = fillDemoCopy(copy.email_subject, values);
  const body = [
    fillDemoCopy(copy.email_greeting, values),
    "",
    fillDemoCopy(cleanPhone ? copy.email_body : copy.email_body_nophone, values),
    "",
    copy.email_change,
    "",
    repName,
  ].join("\n");

  const readiness = await outreachStatus(rep).catch(() => ({ canSend: false }));
  if (readiness.canSend) {
    const lead = row?.lead ? { ...row.lead, email: cleanEmail } : { email: cleanEmail };
    const result = await deliverOutreach({ rep, lead, thread: null, to: [cleanEmail], subject, body, attachments });
    if (result.ok) return;
    // Suppressed is a real answer, not a hiccup: the person is on the
    // do-not-contact list and the rep will see the booking on the calendar.
    if (result.suppressed) return;
    throw new Error(result.error || "deliverOutreach refused");
  }
  const from = await getPlatformFrom();
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0b1a2e;white-space:pre-line">${body.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c])}</div>`;
  await sendEmail({ from, to: cleanEmail, subject, html, text: body, replyTo: rep.workEmail || undefined, attachments });
}
