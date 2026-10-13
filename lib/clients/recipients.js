// lib/clients/recipients.js
//
// Who a quote or invoice goes to when a person sends it by hand and picks
// among the client's contacts (owner, 2026-10-13).
//
// ══ The default is today's send, byte for byte ═════════════════════════════
//
// No `recipients` in the request → the routes do exactly what they did: the
// client's email, trimmed, as one string. The picker only adds `recipients`
// when the selection differs from that default (recipientsForBody), and only
// for an organisation client with more than one contact — so every existing
// send, and every send to a homeowner, posts the same body and hands
// sendEmail the same `to` as before. scripts/check-client-contacts.mjs proves
// it with md5s of both.
//
// ══ The browser names people, never addresses ══════════════════════════════
//
// The same rule as non-negotiable #5 for money: the request carries
// { primary: true|false, contactIds: [...] } and the server reads the
// addresses off this client's own rows, under its company. An address typed
// into the request is not a recipient — otherwise "send this invoice" would be
// "email any address with the company's name on it".

import { cleanEmail } from "@/lib/validation";

/** The selection the screen starts on: the primary, nobody else. */
export const DEFAULT_SELECTION = Object.freeze({ primary: true, contactIds: Object.freeze([]) });

/** Is this selection the default (the primary only)? Pure. */
export function isDefaultSelection(sel) {
  if (!sel || typeof sel !== "object") return true;
  const ids = Array.isArray(sel.contactIds) ? sel.contactIds.filter(Boolean) : [];
  return sel.primary !== false && ids.length === 0;
}

/**
 * The request body with the picker's choice added — or the SAME object,
 * untouched, when the choice is the default. Pure.
 */
export function recipientsForBody(body, sel) {
  if (isDefaultSelection(sel)) return body;
  const ids = [...new Set((sel.contactIds || []).filter((x) => typeof x === "string" && x))];
  return { ...body, recipients: { primary: sel.primary !== false, contactIds: ids } };
}

/** "a@x.com" or "a@x.com, b@y.com" — for the sentToEmail column and the trail. */
export function recipientText(to) {
  return Array.isArray(to) ? to.join(", ") : String(to || "");
}

/**
 * Should the send screen offer the picker? Only an organisation client, and
 * only when there is a choice to make: more than one contact with an address.
 * Pure — the screens and the check both ask it.
 */
export function offersRecipientPicker(client, entries = []) {
  if (!client || client.type !== "company") return false;
  const reachable = (Array.isArray(entries) ? entries : []).filter((e) => e && e.email);
  return reachable.length > 1;
}

/**
 * Resolve a selection to the `to` sendEmail gets.
 *
 * @param client     the client row the route already loaded under its company
 *                   ({ id, companyId, type, email })
 * @param selection  body.recipients — undefined/null means "as today"
 * @returns {Promise<{ to: string|string[]|undefined } | { error: string, code: string, status: number }>}
 *          `to` is the client's trimmed email (possibly undefined, exactly as
 *          today — the route's own "no email on file" refusal still answers)
 *          for the default, one string for one address, an array for several.
 */
export async function resolveSendRecipients(db, { companyId, client, selection }) {
  const today = client?.email?.trim();
  if (selection == null) return { to: today };
  if (typeof selection !== "object" || Array.isArray(selection)) {
    return { error: "Choose who receives this from the client's contacts.", code: "bad_recipients", status: 400 };
  }
  const ids = Array.isArray(selection.contactIds) ? [...new Set(selection.contactIds.filter((x) => typeof x === "string" && x))] : [];
  if (isDefaultSelection(selection)) return { to: today };
  if (!client?.id || !companyId || client.companyId !== companyId) {
    return { error: "Not found", code: "not_found", status: 404 };
  }
  // Contacts belong to the Organization card, which an individual does not
  // have — a homeowner switched back from "company" keeps their contacts on
  // file, hidden, and they receive nothing from a send.
  if (ids.length && client.type !== "company") {
    return { error: "Only an organisation client's contacts can be chosen.", code: "not_organisation", status: 400 };
  }

  const addresses = [];
  if (selection.primary !== false && today) addresses.push(today);
  if (ids.length) {
    const rows = await db.clientContact.findMany({
      where: { companyId, clientId: client.id, id: { in: ids } },
      select: { id: true, email: true, companyId: true, clientId: true },
    });
    const found = new Map(rows.filter((r) => r.companyId === companyId && r.clientId === client.id).map((r) => [r.id, r]));
    if (ids.some((x) => !found.has(x))) {
      return { error: "One of the chosen contacts isn't on this client.", code: "unknown_contact", status: 400 };
    }
    for (const x of ids) {
      const email = cleanEmail(found.get(x).email || "");
      if (!email) return { error: "One of the chosen contacts has no email address.", code: "contact_no_email", status: 400 };
      addresses.push(email);
    }
  }
  const seen = new Set();
  const unique = addresses.filter((a) => {
    const k = a.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length === 0) {
    return { error: "Choose at least one contact with an email address.", code: "no_recipients", status: 400 };
  }
  return { to: unique.length === 1 ? unique[0] : unique };
}
