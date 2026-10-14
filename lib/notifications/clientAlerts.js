// lib/notifications/clientAlerts.js
//
// "Tell me when the client acts" — the owner, 2026-10-14: "is there a way for
// a company to be notified when the client has opened the quote?", then "yes
// and as a text message as optional in the notifications (send me a text when
// the client has opened / approved a quote / change order / request)".
//
// Four client events, each already (or now) a feed type in
// lib/notifications/catalog.js. This file is the TABLE of how each one may
// reach a person — bell + push, email, text — and every default, so that
// notifyEvent (lib/notifications/notify.js), the two pre-existing emails that
// now honour a person's choice, the settings route and the settings screen
// all read one answer. Pure: scripts/check-client-alerts.mjs executes it.
//
// ══ Two switches, two owners ═════════════════════════════════════════════
//
//   1. The COMPANY switch per event — a NotificationRule row (type below,
//      written by POST /api/settings/notification-rules, owners/admins only).
//      No row = never configured = ON, the invoice_paid rule's convention
//      (lib/notifications/invoicePaymentNotice.js). OFF means nobody in the
//      company is alerted about that event on ANY channel — the bell, push,
//      email and text — including the quote-approval team email that existed
//      before this. The client's own signed copy is never affected: it is
//      the client's document, not an alert.
//   2. Each PERSON's channels per event — MemberAlertPreference, their own
//      row only. Null = never chosen = the default below.
//
// ══ Who ═══════════════════════════════════════════════════════════════════
//
// Nothing here widens an audience. A person is a candidate only if the
// catalog's resolver (lib/notifications/recipients.js) already admits them for
// the type — which is where "never a member who can't see that quote or its
// amounts" lives (requiresMoneySight on the money types). The channel choice
// narrows from there; it cannot add anybody.

import { UNRESTRICTED_ROLES, canSeeMoney } from "@/lib/permissions/enforce";

/**
 * The events, in the order the settings screen lists them.
 *
 *   rule   the NotificationRule type that is the company switch
 *   email  the default for a person who never chose:
 *            "off"      — nobody, until they tick it ("opened" is noise; a
 *                         change-order approval never emailed anyone before)
 *            "managers" — owners and admins: exactly who the quote-approval
 *                         team email always went to, so a company that
 *                         touches nothing keeps getting it
 *            "holder"   — whoever holds the request: the client-ticket email
 *                         always went to the assignee (else the owner), and
 *                         still does; the switch lets that person stop it
 *   emailVia  which code sends the email — "alert" is the new team notice
 *             (lib/notifications/staffTexts.js sendAlertEmails); "decision"
 *             and "ticket" are the emails that already existed, which read
 *             emailOn() rather than being duplicated.
 */
export const CLIENT_ALERTS = Object.freeze({
  "quote.viewed": Object.freeze({ rule: "quote_viewed", email: "off", emailVia: "alert", peopleScoped: true }),
  "quote.accepted": Object.freeze({ rule: "quote_accepted", email: "managers", emailVia: "decision", peopleScoped: false }),
  "changeOrder.approved": Object.freeze({ rule: "change_order_approved", email: "off", emailVia: "alert", peopleScoped: true }),
  "client_ticket.opened": Object.freeze({ rule: "client_request", email: "holder", emailVia: "ticket", peopleScoped: false }),
});

export const CLIENT_ALERT_EVENTS = Object.freeze(Object.keys(CLIENT_ALERTS));
export const ALERT_CHANNELS = Object.freeze(["inApp", "email", "sms"]);

/** The NotificationRule types that are the company switches. */
export const CLIENT_ALERT_RULES = Object.freeze(CLIENT_ALERT_EVENTS.map((e) => CLIENT_ALERTS[e].rule));

/** A re-open alerts again only after this long since the last alert. */
export const VIEW_ALERT_GAP_HOURS = 24;

/**
 * Texts per PERSON per rolling 24 hours. FieldQuo pays for these; a quote
 * forwarded round a family, or a portal client filing ten requests, must not
 * become a hundred texts to one phone. Past the cap the bell still rings —
 * only the text is withheld, and it is recorded as rate_limited.
 */
export const STAFF_TEXT_DAILY_CAP = 20;

/** The table entry, or null. Own-property lookup, like typeMeta. */
export function clientAlertMeta(type) {
  return Object.prototype.hasOwnProperty.call(CLIENT_ALERTS, type) ? CLIENT_ALERTS[type] : null;
}

/** The event a company-switch rule type belongs to, or null. */
export function eventForRule(ruleType) {
  return CLIENT_ALERT_EVENTS.find((e) => CLIENT_ALERTS[e].rule === ruleType) || null;
}

/**
 * Is the company switch on? A NotificationRule row or null.
 * No row = never configured = ON.
 */
export function companyAlertOn(ruleRow) {
  return !ruleRow || ruleRow.active !== false;
}

/**
 * The default for a person who never chose. `member` is { role }.
 * Unknown channel or event = off: a default nobody declared is not a yes.
 */
export function channelDefault(type, channel, member = {}) {
  const meta = clientAlertMeta(type);
  if (!meta) return false;
  if (channel === "inApp") return true;
  // Texts cost money and reach a phone in somebody's pocket at dinner. Never
  // on until the person asks.
  if (channel === "sms") return false;
  if (channel === "email") {
    if (meta.email === "managers") return UNRESTRICTED_ROLES.has(member?.role);
    if (meta.email === "holder") return true;
    return false;
  }
  return false;
}

/**
 * Is this channel on for this person? `pref` is their MemberAlertPreference
 * row for the event, or null. A stored true/false wins; null is the default.
 */
export function channelOn(pref, type, channel, member = {}) {
  if (!clientAlertMeta(type) || !ALERT_CHANNELS.includes(channel)) return false;
  const stored = pref ? pref[channel] : null;
  if (stored === true || stored === false) return stored;
  return channelDefault(type, channel, member);
}

/**
 * Should this open of the quote alert the team?
 *
 * The first recorded open does. After that, only once the last alert is at
 * least VIEW_ALERT_GAP_HOURS old — "opened again (3rd time)" the next
 * evening, not a ping per scroll. The route makes the same test again inside
 * a conditional UPDATE so two tabs at once alert once; this is the decision,
 * that is the race guard.
 */
export function viewAlertDue({ lastAlertAt = null, now = new Date() } = {}) {
  if (!lastAlertAt) return true;
  const last = new Date(lastAlertAt).getTime();
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= VIEW_ALERT_GAP_HOURS * 60 * 60 * 1000;
}

/** Under the daily cap? `sentInLastDay` counts this person's SENT texts. */
export function underDailyCap(sentInLastDay, cap = STAFF_TEXT_DAILY_CAP) {
  return Number(sentInLastDay || 0) < cap;
}

/**
 * The amount this reader may be told, or null. The fan-out already refuses a
 * money type to anyone without showPricing; this is the second, independent
 * gate on the message itself, so widening a recipient list can never widen
 * what a text says.
 */
export function amountForReader(member, amount) {
  if (amount === null || amount === undefined || amount === "") return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return canSeeMoney(member || null) ? n : null;
}

/**
 * The quote's people for a people-scoped event: who wrote it and who is
 * working it. Owners and admins are added by recipients.js from
 * UNRESTRICTED_ROLES, never by naming a role here.
 */
export function quotePeople(...ids) {
  return [...new Set(ids.flat().filter((v) => typeof v === "string" && v))];
}

/**
 * A PUT body for /api/settings/alert-preferences, checked. PURE.
 *
 *   { event, channel, on }   one switch for one event
 *   { phone }                the person's own mobile ("" clears it)
 *
 * Anything else is refused by name rather than half-applied: a body that
 * names an event this table does not have would otherwise be a row nothing
 * ever reads (failure class #1).
 */
export function validateAlertPatch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "bad_body" };
  if ("phone" in body) {
    if (typeof body.phone !== "string" || body.phone.length > 40) return { ok: false, error: "bad_phone" };
    return { ok: true, data: { phone: body.phone.trim() } };
  }
  if (!clientAlertMeta(body.event)) return { ok: false, error: "unknown_event" };
  if (!ALERT_CHANNELS.includes(body.channel)) return { ok: false, error: "unknown_channel" };
  if (typeof body.on !== "boolean") return { ok: false, error: "on_must_be_boolean" };
  return { ok: true, data: { event: body.event, channel: body.channel, on: body.on } };
}
