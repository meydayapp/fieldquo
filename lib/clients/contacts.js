// lib/clients/contacts.js
//
// The people at an organisation client (owner, 2026-10-13: a PSPC tender
// names a Contracting Authority, and the Technical Authority, the site contact
// and accounts payable are other people again).
//
// ══ The primary contact is still the client's own three columns ════════════
//
// Client.contactName / email / phone are read in dozens of places — the quote
// and invoice emails, the PDFs, the follow-up cron, the portal, the SMS
// reminders. They stay THE primary contact, and nothing here asks any of
// those readers to change. A ClientContact row is an ADDITIONAL person.
//
// The one exception is a row with isPrimary: the same person as those three
// columns, kept in step with them by this file (the only writer of either
// side from the contacts card, and syncPrimaryFromClient for the client's own
// edit form), so the primary can carry a role ("Contracting Authority") and
// notes like everyone else. A client nobody has touched has no rows at all,
// and the card shows its three columns as the primary — nothing is migrated.
//
// "Make primary" never loses anyone: the person the three columns held is
// kept as an ordinary contact (their existing primary row, or a new one made
// from the columns) before the chosen contact's details are written over them.
//
// ══ Who may ════════════════════════════════════════════════════════════════
//
// The routes ask the same levels the client record does: reading contacts is
// clientsProperties "full_view" (contact details — redactClient strips
// `contacts` below it, CLIENT_RESTRICTED_FIELDS), writing is "full_edit", the
// level PATCH /api/clients/[id] asks. Every read and write is scoped by
// companyId AND clientId; another company's contact id is "not found".

import { emailRefusal, cleanEmail } from "@/lib/validation";

/**
 * Role suggestions, as message keys — the field is free text and stores what
 * was typed; these are what the input offers, in the reader's language.
 */
export const CONTACT_ROLE_SUGGESTIONS = Object.freeze([
  "app.orgCard.role.contractingAuthority",
  "app.orgCard.role.technicalAuthority",
  "app.orgCard.role.projectAuthority",
  "app.orgCard.role.siteContact",
  "app.orgCard.role.accountsPayable",
]);

export const CONTACT_LIMITS = Object.freeze({ name: 200, role: 100, phone: 40, notes: 2000 });
/** A client with more than this many contacts is a list somebody imported by mistake. */
export const MAX_CONTACTS_PER_CLIENT = 50;

const str = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * What a contact form sent, cleaned. Pure.
 *
 * @returns {{ ok: true, data: { name, role, email, phone, notes } } | { ok: false, error: string, code: string }}
 */
export function cleanContactInput(body = {}) {
  const name = str(body.name).slice(0, CONTACT_LIMITS.name);
  if (!name) return { ok: false, error: "Give the contact a name.", code: "name_required" };
  const rawEmail = str(body.email);
  const bad = rawEmail ? emailRefusal(rawEmail) : null;
  if (bad) return { ok: false, error: bad.error, code: "invalid_email" };
  return {
    ok: true,
    data: {
      name,
      role: str(body.role).slice(0, CONTACT_LIMITS.role) || null,
      email: rawEmail ? cleanEmail(rawEmail) : null,
      phone: str(body.phone).slice(0, CONTACT_LIMITS.phone) || null,
      notes: str(body.notes).slice(0, CONTACT_LIMITS.notes) || null,
    },
  };
}

const PUBLIC_FIELDS = (row) => ({
  id: row.id,
  name: row.name,
  role: row.role || null,
  email: row.email || null,
  phone: row.phone || null,
  notes: row.notes || null,
  isPrimary: row.isPrimary === true,
  sortOrder: Number(row.sortOrder) || 0,
});

/**
 * The list the card draws: the primary first, then everyone else in their
 * order. Pure.
 *
 * The primary's name / email / phone come from the CLIENT row whichever way it
 * is stored — those columns are what every document actually uses, so the
 * card can never show a primary the quote email would not reach. `id: null`
 * marks a primary that exists only as those columns (no row yet).
 */
export function contactEntries(client, rows = []) {
  if (!client) return [];
  const list = Array.isArray(rows) ? rows : [];
  const primaryRow = list.find((r) => r?.isPrimary === true) || null;
  const others = list
    .filter((r) => r && r.isPrimary !== true)
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .map(PUBLIC_FIELDS);

  const fromClient = {
    name: str(client.contactName) || (primaryRow ? primaryRow.name : ""),
    email: str(client.email) || null,
    phone: str(client.phone) || null,
  };
  let primary = null;
  if (primaryRow) {
    primary = { ...PUBLIC_FIELDS(primaryRow), ...fromClient, isPrimary: true };
  } else if (fromClient.name || fromClient.email || fromClient.phone) {
    primary = { id: null, ...fromClient, role: null, notes: null, isPrimary: true, sortOrder: -1 };
  }
  return primary ? [primary, ...others] : others;
}

/** The Organization card's free-text fields: trimmed, capped, "" clears. */
export const ORG_TEXT_MAX = 2000;
export const orgText = (v) => (typeof v === "string" ? v.trim().slice(0, ORG_TEXT_MAX) || null : null);
/** Is this a value the Organization fields accept — a string, or null to clear? */
export const orgWritable = (v) => typeof v === "string" || v === null;

/**
 * The Organization card's half of a client payload, by client type. Pure.
 *
 * A company client carries its department, procurement notes and contacts;
 * an individual's payload has none of those keys at all — the homeowner page
 * reads exactly what it read before the card existed (only the switch's own
 * two columns, which every client type has, are new). The columns and rows
 * are KEPT for an individual (switching back to "company" shows them again);
 * they are simply not part of what an individual is.
 */
export function organizationShape(client, contactRows) {
  if (!client || typeof client !== "object") return client;
  const out = { ...client };
  if (client.type === "company") {
    out.contacts = contactEntries(client, contactRows || []);
  } else {
    delete out.organizationUnit;
    delete out.procurementNotes;
  }
  return out;
}

/** The client row, under its company, or null. */
async function ownClient(db, { companyId, clientId }) {
  if (!companyId || !clientId) return null;
  return db.client.findFirst({
    where: { id: String(clientId), companyId },
    select: { id: true, companyId: true, name: true, type: true, contactName: true, email: true, phone: true },
  });
}

async function ownRows(db, { companyId, clientId }) {
  return db.clientContact.findMany({
    where: { companyId, clientId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/** { client, entries } for the card, or null when the client is not this company's. */
export async function listContacts(db, { companyId, clientId }) {
  const client = await ownClient(db, { companyId, clientId });
  if (!client) return null;
  const rows = await ownRows(db, { companyId, clientId });
  return { client, entries: contactEntries(client, rows) };
}

/**
 * What the client's three columns become when `contact` is the primary.
 * contactName only for a company client: an individual IS the person, and the
 * client edit route keeps contactName null for one.
 */
function primaryColumns(client, contact) {
  return {
    ...(client.type === "company" ? { contactName: contact.name || null } : {}),
    email: contact.email || null,
    phone: contact.phone || null,
  };
}

const fail = (status, error, code) => ({ ok: false, status, error, code });

/** Add a contact at the end of the list. */
export async function createContact(db, { companyId, clientId, body }) {
  const client = await ownClient(db, { companyId, clientId });
  if (!client) return fail(404, "Not found", "not_found");
  const input = cleanContactInput(body);
  if (!input.ok) return fail(400, input.error, input.code);
  const rows = await ownRows(db, { companyId, clientId });
  if (rows.length >= MAX_CONTACTS_PER_CLIENT) return fail(409, `A client can have at most ${MAX_CONTACTS_PER_CLIENT} contacts.`, "too_many");
  const sortOrder = rows.reduce((m, r) => Math.max(m, Number(r.sortOrder) || 0), 0) + 1;
  const row = await db.clientContact.create({
    data: { companyId, clientId: client.id, ...input.data, isPrimary: false, sortOrder },
  });
  return { ok: true, contact: PUBLIC_FIELDS(row), changedClient: [] };
}

/**
 * Edit one contact. `id: "primary"` edits the primary that exists only as the
 * client's columns — it becomes a row (so it can keep a role and notes) and
 * the columns take the new name / email / phone.
 *
 * @returns {{ ok, contact, changedClient: string[] }} changedClient names the
 *          client columns that changed, for the activity trail
 */
export async function updateContact(db, { companyId, clientId, id, body }) {
  const client = await ownClient(db, { companyId, clientId });
  if (!client) return fail(404, "Not found", "not_found");
  const input = cleanContactInput(body);
  if (!input.ok) return fail(400, input.error, input.code);

  let row = null;
  if (id === "primary") {
    row = await db.clientContact.findFirst({ where: { companyId, clientId: client.id, isPrimary: true } });
  } else {
    row = await db.clientContact.findFirst({ where: { id: String(id), companyId, clientId: client.id } });
    if (!row) return fail(404, "Not found", "not_found");
  }

  const isPrimary = id === "primary" || row?.isPrimary === true;
  if (!isPrimary) {
    const updated = await db.clientContact.update({ where: { id: row.id }, data: input.data });
    return { ok: true, contact: PUBLIC_FIELDS(updated), changedClient: [] };
  }

  const columns = primaryColumns(client, input.data);
  const changedClient = Object.keys(columns).filter((k) => (client[k] ?? null) !== (columns[k] ?? null));
  const saved = await db.$transaction(async (tx) => {
    const kept = row
      ? await tx.clientContact.update({ where: { id: row.id }, data: { ...input.data, isPrimary: true } })
      : await tx.clientContact.create({ data: { companyId, clientId: client.id, ...input.data, isPrimary: true, sortOrder: 0 } });
    if (changedClient.length) await tx.client.update({ where: { id: client.id }, data: columns });
    return kept;
  });
  return { ok: true, contact: PUBLIC_FIELDS(saved), changedClient };
}

/** Make one contact the primary. Nobody is lost — see the file header. */
export async function makePrimary(db, { companyId, clientId, id }) {
  const client = await ownClient(db, { companyId, clientId });
  if (!client) return fail(404, "Not found", "not_found");
  const target = await db.clientContact.findFirst({ where: { id: String(id), companyId, clientId: client.id } });
  if (!target) return fail(404, "Not found", "not_found");
  if (target.isPrimary) return { ok: true, contact: PUBLIC_FIELDS(target), changedClient: [] };

  const columns = primaryColumns(client, target);
  const changedClient = Object.keys(columns).filter((k) => (client[k] ?? null) !== (columns[k] ?? null));
  const current = await db.clientContact.findFirst({ where: { companyId, clientId: client.id, isPrimary: true } });
  const holder = {
    name: str(client.contactName) || str(client.email) || str(client.phone),
    email: str(client.email) || null,
    phone: str(client.phone) || null,
  };

  const saved = await db.$transaction(async (tx) => {
    if (current) {
      await tx.clientContact.update({ where: { id: current.id }, data: { isPrimary: false, sortOrder: target.sortOrder } });
    } else if (holder.name) {
      // The person only the columns knew about — kept, in the chosen
      // contact's old place in the list.
      await tx.clientContact.create({
        data: { companyId, clientId: client.id, name: holder.name.slice(0, CONTACT_LIMITS.name), email: holder.email, phone: holder.phone, isPrimary: false, sortOrder: target.sortOrder },
      });
    }
    const promoted = await tx.clientContact.update({ where: { id: target.id }, data: { isPrimary: true, sortOrder: 0 } });
    if (changedClient.length) await tx.client.update({ where: { id: client.id }, data: columns });
    return promoted;
  });
  return { ok: true, contact: PUBLIC_FIELDS(saved), changedClient };
}

/** Remove one contact — the contact only, never the client. Not the primary. */
export async function removeContact(db, { companyId, clientId, id }) {
  const client = await ownClient(db, { companyId, clientId });
  if (!client) return fail(404, "Not found", "not_found");
  const row = await db.clientContact.findFirst({ where: { id: String(id), companyId, clientId: client.id } });
  if (!row) return fail(404, "Not found", "not_found");
  // The primary is the client's own email and phone — every document goes
  // there. Removing it would leave those columns naming someone the card no
  // longer lists; choosing someone else first is the honest order.
  if (row.isPrimary) return fail(409, "This is the primary contact. Make someone else primary first.", "primary");
  await db.clientContact.delete({ where: { id: row.id } });
  return { ok: true, removed: row.id, name: row.name };
}

/**
 * Put the non-primary contacts in this order. Ids that are not this client's
 * are refused as a whole — a reorder is one decision, not a partial one.
 */
export async function reorderContacts(db, { companyId, clientId, ids }) {
  const client = await ownClient(db, { companyId, clientId });
  if (!client) return fail(404, "Not found", "not_found");
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) return fail(400, "Send the contact ids in their new order.", "bad_order");
  const rows = await ownRows(db, { companyId, clientId: client.id });
  const movable = new Set(rows.filter((r) => !r.isPrimary).map((r) => r.id));
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length || unique.some((x) => !movable.has(x))) return fail(400, "That order names a contact that isn't on this client.", "bad_order");
  await db.$transaction(unique.map((cid, i) => db.clientContact.update({ where: { id: cid }, data: { sortOrder: i + 1 } })));
  return { ok: true };
}

/**
 * After the client's own edit form changed contactName / email / phone, the
 * primary row (if there is one) follows, so the card and the documents can
 * never disagree. Never throws — the client edit already saved.
 */
export async function syncPrimaryFromClient(db, { companyId, clientId, client }) {
  try {
    if (!db?.clientContact?.updateMany || !companyId || !clientId || !client) return;
    const data = {
      ...(str(client.contactName) ? { name: str(client.contactName).slice(0, CONTACT_LIMITS.name) } : {}),
      email: str(client.email) || null,
      phone: str(client.phone) || null,
    };
    await db.clientContact.updateMany({ where: { companyId, clientId, isPrimary: true }, data });
  } catch (err) {
    console.error("[contacts] primary not kept in step:", err?.message);
  }
}
