// lib/sales/outreach/introRequests.js
//
// What happens when a prospect presses one of the intro email's links, and
// how the rep sees it afterwards.
//
// ══ Three kinds, one door ════════════════════════════════════════════════
//
//   callback     stamps SalesIntroEmail.callbackRequestedAt once, writes a
//                SalesEvent of type "callback" on the rep's calendar at the
//                next business hour where the prospect is — the same row the
//                rep's own "Schedule a call back" writes (app/api/sales/
//                events) — and pushes the rep.
//   demo         stamps demoRequestedAt once and pushes the rep. Since the
//                rep's own booking page exists (app/demo/[repCode], lib/
//                sales/demoBooking/book.js) the email's button lands THERE
//                and the prospect picks a slot; this door is kept for the
//                emails sent before it, and for a prospect who reaches the
//                page and does not choose a time. Nothing here invents a
//                slot — the rep rings to fix one.
//   unsubscribe  puts the address on FieldQuo's do-not-contact list for the
//                email channel, source "form". Idempotent.
//
// Every one of them is a POST the prospect pressed a button for. The GET
// only reads (introLinkState) — see lib/sales/outreach/introLink.js for why.
//
// ══ "Unhandled" is read, not stored ══════════════════════════════════════
//
// The Today counters show requests the rep has not dealt with. A request is
// dealt with when the rep says so (handledAt, the button on the lead page)
// OR when the rep has since dialled the lead — read from SalesCallAttempt
// at query time, the way promisedCallbacks() (lib/sales/calls/store.js)
// reads "kept" from later dials rather than from a flag. A flag the dial
// path had to remember to set is a flag it would forget.

import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { appSentence, pushToReps } from "@/lib/notify/push";
import { resolveLeadTimeZone } from "@/lib/sales/leadTimeZone";
import { suppress } from "@/lib/sales/suppression";
import { INTRO_REQUEST_KINDS, nextBusinessHour, openIntroLink } from "./introLink";
import { repNumberFor } from "./introSend";
import { repPublicName } from "@/lib/sales/repIdentity";

const ROW_SELECT = {
  id: true,
  salesRepId: true,
  leadId: true,
  toAddress: true,
  language: true,
  sentAt: true,
  expiresAt: true,
  callbackRequestedAt: true,
  callbackEventId: true,
  demoRequestedAt: true,
  demoEventId: true,
  handledAt: true,
  salesRep: { select: { id: true, name: true, workName: true } },
  lead: {
    select: {
      id: true,
      businessName: true,
      contactName: true,
      phone: true,
      email: true,
      timeZone: true,
      country: true,
      province: true,
      prospect: { select: { websiteUrl: true, country: true, province: true } },
    },
  },
};

/**
 * Open the token and load the row it names, checking the two agree.
 *
 * @returns { ok: true, row, kind } | { ok: false, reason }
 *          reasons: the token's (unconfigured, malformed, tampered, expired)
 *          plus `unknown` (no such row) and `mismatch` (row and token
 *          disagree about the lead or the rep — a token from one send
 *          pointed at another's row).
 */
export async function resolveIntroLink(token, { client = db, now = new Date() } = {}) {
  const opened = openIntroLink(token, { now });
  if (!opened.ok) return opened;
  const row = await client.salesIntroEmail.findUnique({ where: { id: opened.introEmailId }, select: ROW_SELECT });
  if (!row) return { ok: false, reason: "unknown" };
  if (row.leadId !== opened.leadId || row.salesRepId !== opened.salesRepId) return { ok: false, reason: "mismatch" };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true, row, kind: opened.kind };
}

/** What the public page shows. Nothing is written. */
export async function introLinkState(token, { client = db, now = new Date() } = {}) {
  const r = await resolveIntroLink(token, { client, now });
  if (!r.ok) return { ok: false, reason: r.reason };
  const { row, kind } = r;
  const already = kind === "callback" ? Boolean(row.callbackRequestedAt) : kind === "demo" ? Boolean(row.demoRequestedAt) : false;
  return {
    ok: true,
    kind,
    language: row.language,
    // A stranger reads this on the link page: the public name (repIdentity.js).
    repName: repPublicName(row.salesRep) || "",
    repPhone: kind === "demo" ? await repNumberFor(row.salesRepId, client) : null,
    businessName: row.lead?.businessName || "",
    already,
  };
}

/**
 * The prospect pressed the button.
 *
 * @returns { ok: true, kind, already: boolean, ...state } | { ok: false, reason }
 */
export async function actIntroLink(token, { client = db, now = new Date() } = {}) {
  const r = await resolveIntroLink(token, { client, now });
  if (!r.ok) return { ok: false, reason: r.reason };
  const { row, kind } = r;

  if (kind === "unsubscribe") {
    const result = await suppress(client, {
      kind: "email",
      value: row.toAddress,
      channels: ["email"],
      source: "form",
      reason: "Unsubscribed from a rep's intro email (the link in the footer).",
      salesLeadId: row.leadId,
      salesRepId: row.salesRepId,
      requestedAt: now,
    });
    if (!result.ok) return { ok: false, reason: "refused", error: result.error };
    // "resuppressed" is a second press, or a mail provider's one-click POST
    // arriving after the human already pressed it — the same outcome, said
    // as "already".
    return { ok: true, kind, already: result.action === "resuppressed", language: row.language };
  }

  if (!INTRO_REQUEST_KINDS.includes(kind)) return { ok: false, reason: "tampered" };

  // ── Once. The WHERE on null is the single-use ─────────────────────────
  const column = kind === "callback" ? "callbackRequestedAt" : "demoRequestedAt";
  const stamped = await client.salesIntroEmail.updateMany({ where: { id: row.id, [column]: null }, data: { [column]: now } });
  const base = {
    ok: true,
    kind,
    language: row.language,
    // A stranger reads this on the link page: the public name (repIdentity.js).
    repName: repPublicName(row.salesRep) || "",
    repPhone: kind === "demo" ? await repNumberFor(row.salesRepId, client) : null,
    businessName: row.lead?.businessName || "",
  };
  if (stamped.count === 0) return { ...base, already: true };

  if (kind === "callback") {
    // The calendar entry: the mechanism the rep's own "Schedule a call back"
    // writes, at the next business hour where the prospect is. The zone is
    // the lead's stated one or the one its province implies (lib/sales/
    // leadTimeZone.js); unknown, the entry is an hour on and says so.
    const zone = resolveLeadTimeZone(row.lead || {});
    const slot = nextBusinessHour(now, zone.timeZone);
    try {
      const event = await client.salesEvent.create({
        data: {
          salesRepId: row.salesRepId,
          type: "callback",
          title: `Call back — asked for from the intro email`,
          startAt: slot.at,
          status: "scheduled",
          leadId: row.leadId,
          businessName: row.lead?.businessName || null,
          contactName: row.lead?.contactName || null,
          phone: row.lead?.phone || null,
          website: row.lead?.prospect?.websiteUrl || null,
          notes:
            `They pressed "call me back" in the intro email sent ${row.sentAt.toISOString().slice(0, 10)} to ${row.toAddress}.` +
            (slot.zone ? ` Booked at the next business hour in ${slot.zone}.` : " Their time zone is not on record, so this is simply an hour on; check before ringing."),
        },
        select: { id: true },
      });
      await client.salesIntroEmail.update({ where: { id: row.id }, data: { callbackEventId: event.id } });
    } catch (err) {
      await recordError({
        area: "sales_outreach",
        code: "intro_callback_event_not_written",
        message: `Call-back request on intro email ${row.id} was stamped but the calendar entry failed: ${err?.message || err}`,
        detail: { salesRepId: row.salesRepId, leadId: row.leadId },
      }).catch(() => {});
    }
  }

  // The push: best-effort, after the write, never on its path.
  const who = row.lead?.businessName || row.toAddress;
  void pushToReps({
    salesRepIds: [row.salesRepId],
    payload: async (language) => ({
      title: await appSentence(language, kind === "callback" ? "app.notify.introCallback.title" : "app.notify.introDemo.title", { business: who }),
      body: await appSentence(language, kind === "callback" ? "app.notify.introCallback.body" : "app.notify.introDemo.body", { business: who }),
      tag: `sales-intro:${row.id}:${kind}`,
      url: `/sales/leads/${encodeURIComponent(row.leadId)}`,
    }),
  }).catch(() => {});

  return { ...base, already: false };
}

/**
 * The rep's unhandled requests and bookings, for Today.
 *
 * A DEMO with a demoEventId is a booking — the prospect chose a slot on
 * the rep's page — and stays on the list until the event has started or
 * the rep marked it done or cancelled; there is nothing to ring about. A
 * demo with only demoRequestedAt is the older request with no time, and
 * a later dial still counts as handling it.
 *
 * @returns {{ callbacks: number, demos: number, demoBookings: number,
 *             items: [{ id, leadId, businessName, kind, requestedAt, at? }] }}
 *          kind is "callback" | "demo" | "demo_booked".
 */
export async function introRequestsForRep({ salesRepId, client = db, now = new Date(), limit = 50 } = {}) {
  const rows = await client.salesIntroEmail.findMany({
    where: {
      salesRepId,
      handledAt: null,
      OR: [{ callbackRequestedAt: { not: null } }, { demoRequestedAt: { not: null } }, { demoEventId: { not: null } }],
    },
    orderBy: { sentAt: "desc" },
    take: 200,
    select: { id: true, leadId: true, callbackRequestedAt: true, demoRequestedAt: true, demoEventId: true, lead: { select: { businessName: true } } },
  });
  if (!rows.length) return { callbacks: 0, demos: 0, demoBookings: 0, items: [] };

  // A dial to the lead after the request is the request handled.
  const earliest = rows.reduce((m, r) => {
    for (const at of [r.callbackRequestedAt, r.demoRequestedAt]) if (at && (!m || at < m)) m = at;
    return m;
  }, null);
  const dials = await client.salesCallAttempt.findMany({
    where: { salesRepId, direction: "out", leadId: { in: [...new Set(rows.map((r) => r.leadId))] }, ...(earliest ? { dialledAt: { gt: earliest } } : {}) },
    select: { leadId: true, dialledAt: true },
  });
  const dialledAfter = (leadId, at) => dials.some((d) => d.leadId === leadId && d.dialledAt > at);

  // The booked demos' events: a booking whose event has started, or was
  // marked done or cancelled, has nothing left to show.
  const eventIds = rows.map((r) => r.demoEventId).filter(Boolean);
  const events = eventIds.length
    ? await client.salesEvent.findMany({ where: { id: { in: eventIds } }, select: { id: true, startAt: true, status: true } })
    : [];
  const eventById = new Map(events.map((e) => [e.id, e]));

  const items = [];
  for (const r of rows) {
    if (r.demoEventId) {
      const ev = eventById.get(r.demoEventId);
      if (ev && ev.status === "scheduled" && ev.startAt > now) {
        items.push({ id: r.id, leadId: r.leadId, businessName: r.lead?.businessName || null, kind: "demo_booked", requestedAt: (r.demoRequestedAt || ev.startAt).toISOString(), at: ev.startAt.toISOString() });
      }
    } else if (r.demoRequestedAt && !dialledAfter(r.leadId, r.demoRequestedAt)) {
      items.push({ id: r.id, leadId: r.leadId, businessName: r.lead?.businessName || null, kind: "demo", requestedAt: r.demoRequestedAt.toISOString() });
    }
    if (r.callbackRequestedAt && !dialledAfter(r.leadId, r.callbackRequestedAt)) {
      items.push({ id: r.id, leadId: r.leadId, businessName: r.lead?.businessName || null, kind: "callback", requestedAt: r.callbackRequestedAt.toISOString() });
    }
  }
  items.sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
  return {
    callbacks: items.filter((i) => i.kind === "callback").length,
    demos: items.filter((i) => i.kind === "demo").length,
    demoBookings: items.filter((i) => i.kind === "demo_booked").length,
    items: items.slice(0, limit),
    now: now.toISOString(),
  };
}

/** The rep says "dealt with". Scoped to their own rows; a second press is a no-op. */
export async function markIntroHandled({ salesRepId, introEmailId, client = db, now = new Date() } = {}) {
  if (!salesRepId || typeof introEmailId !== "string" || !introEmailId) return { ok: false, status: 400, error: "Which request?" };
  const r = await client.salesIntroEmail.updateMany({ where: { id: introEmailId, salesRepId, handledAt: null }, data: { handledAt: now } });
  return { ok: true, changed: r.count > 0 };
}

/** The lead page's timeline: every intro email to this lead and what it asked for. */
export async function introEmailsForLead({ salesRepId, leadId, client = db } = {}) {
  if (!salesRepId || !leadId) return [];
  const rows = await client.salesIntroEmail.findMany({
    where: { leadId, lead: { salesRepId } },
    orderBy: { sentAt: "desc" },
    select: {
      id: true,
      toAddress: true,
      language: true,
      sentAt: true,
      threadId: true,
      callbackRequestedAt: true,
      callbackEventId: true,
      demoRequestedAt: true,
      demoEventId: true,
      handledAt: true,
      salesRep: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    toAddress: r.toAddress,
    language: r.language,
    sentAt: r.sentAt.toISOString(),
    threadId: r.threadId,
    sentBy: r.salesRep?.name || null,
    callbackRequestedAt: r.callbackRequestedAt ? r.callbackRequestedAt.toISOString() : null,
    callbackEventId: r.callbackEventId,
    demoRequestedAt: r.demoRequestedAt ? r.demoRequestedAt.toISOString() : null,
    demoEventId: r.demoEventId || null,
    handledAt: r.handledAt ? r.handledAt.toISOString() : null,
  }));
}
