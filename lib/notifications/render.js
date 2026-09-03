// lib/notifications/render.js
//
// Turning a stored NotificationDelivery into something a person reads.
//
// Pure — no database, no React — so both the API route and
// scripts/check-notifications.mjs execute exactly the same decision. The
// sentence itself is assembled by the BROWSER, from the reader's own message
// catalogue (`app.notif.<type>`), because a row is written once and may be read
// by an English and a French member of the same company.
//
// ══ Where money is decided ═════════════════════════════════════════════════
//
// Twice, on purpose.
//
//   1. At fan-out. lib/notifications/recipients.js never creates a delivery of
//      a `money: true` type for a member without showPricing. Audit §10.8: not
//      "redacted for" — not delivered to.
//   2. Here, at read. `amountFor` re-asks the question against the member
//      making THIS request, and withholds the figure if the answer changed.
//
// The second is not redundant. A permission grid can be edited after a delivery
// row exists: an owner demotes somebody to Crew on Tuesday and every money
// notification already in their feed would otherwise still carry a price.
import { typeMeta } from "@/lib/notifications/catalog";
import { hasToggle } from "@/lib/permissions/enforce";

/**
 * Where a feed row goes when it is tapped.
 *
 * Derived from entityType/entityId rather than stored, so a route rename is one
 * edit here instead of a column full of stale URLs. Returns null when the event
 * has no destination — the row is then plain text, never a dead link, which is
 * AGENTS.md's first rule applied to an <a>.
 */
export function hrefFor({ entityType, entityId }) {
  if (!entityId || typeof entityId !== "string") {
    // The estimate queue and the time-off screen are LISTS: they are worth
    // opening even when the specific record is gone.
    return null;
  }
  switch (entityType) {
    case "quote":
      return `/app/quotes/${entityId}`;
    case "invoice":
      return `/app/invoices/${entityId}`;
    case "lead":
      return `/app/leads`;
    case "leave":
      return `/app/time-off`;
    default:
      return null;
  }
}

/**
 * The amount this reader may see, or null.
 *
 * @param event   { type, amount, currency }
 * @param member  { role, permissions } — the CALLER, resolved from their own
 *                session, never a member id off the request
 */
export function amountFor(event, member) {
  const meta = typeMeta(event?.type);
  if (!meta || meta.money !== true) return null;
  if (event?.amount == null) return null;
  // hasToggle is the right function HERE, unlike at fan-out: this is the read
  // side, the member is loaded and real, and its fall-open cases (no grid, no
  // stated toggle) are the same ones that let a legacy member read the quote
  // this row points at. Withholding here while the destination screen shows the
  // figure would be theatre, not a boundary.
  return hasToggle(member, "showPricing") ? Number(event.amount) : null;
}

/**
 * The secondary line under a feed row, as translation KEYS.
 *
 * ── Why this exists at all ────────────────────────────────────────────────
 *
 * Every param a type declares has to be READ by something. A `params` key that
 * is written and never rendered is a stored field nothing reads — AGENTS.md
 * failure class #1, and the exact fault this change removed from
 * NotificationRule.channel. The main sentence interpolates some of them; this
 * function consumes the rest, and scripts/check-notifications.mjs asserts that
 * between the two, every declared param of every type is accounted for. Add a
 * param without rendering it and the check fails.
 *
 * Keys rather than sentences, because this module is imported by a Node check
 * script as well as by the browser — the browser resolves them through its own
 * t(), which is where the reader's language lives.
 *
 * Every value handled here comes from a CLOSED vocabulary: refund/dispute,
 * hot/warm/cold, and three booleans. An open-ended value (a lead's source, a
 * quote's estimateSource) is deliberately not a param at all — see the comments
 * on those two types in catalog.js.
 */
export function noteKeysFor({ params }) {
  const p = params || {};
  const keys = [];

  if (p.kind === "refund" || p.kind === "dispute") keys.push(`app.notif.kind.${p.kind}`);
  if (p.settled === true) keys.push("app.notif.note.settled");
  if (p.settled === false) keys.push("app.notif.note.balanceLeft");
  if (p.autoApproved === true) keys.push("app.notif.note.autoApproved");
  if (p.autoApproved === false) keys.push("app.notif.note.needsApproval");
  if (p.fromCall === true) keys.push("app.notif.note.fromCall");
  if (p.fromCall === false) keys.push("app.notif.note.fromForm");
  if (["hot", "warm", "cold"].includes(p.temperature)) keys.push(`app.notif.temp.${p.temperature}`);

  return keys;
}

/** Every param key noteKeysFor can consume, for the check script's audit. */
export const NOTE_PARAMS = ["kind", "settled", "autoApproved", "fromCall", "temperature"];

/**
 * The payload one feed row becomes over the wire.
 *
 * Deliberately carries no member id, no user id and no email address: the only
 * person this row can belong to is the caller, and echoing their own id back
 * would invite a client to send one in.
 */
export function serialiseDelivery(delivery, member) {
  const event = delivery?.event || {};
  const amount = amountFor(event, member);
  return {
    id: delivery.id,
    type: event.type,
    severity: typeMeta(event.type)?.severity || "normal",
    params: event.params || {},
    amount,
    currency: amount == null ? null : event.currency || null,
    actorName: event.actorName || null,
    href: hrefFor({ entityType: event.entityType, entityId: event.entityId }),
    createdAt: event.createdAt,
    readAt: delivery.readAt,
  };
}
